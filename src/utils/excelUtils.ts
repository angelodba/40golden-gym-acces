import * as XLSX from 'xlsx';
import { Member } from '../types';
import { generateSecureQrToken } from './crypto';
import { generateUUID } from '../lib/crypto';

export interface ParsedClientRow {
  id?: string;
  name: string;
  lastName: string;
  dni: string;
  phone: string;
  email: string;
  planName: string;
  debtAmount: number;
}

export interface ImportPreviewItem extends ParsedClientRow {
  qrToken: string;
  isValid: boolean;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza encabezados de columnas: quita tildes, minúsculas, elimina espacios extras.
 */
function normalizeHeader(header: string): string {
  return String(header || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitiza un valor de celda Excel que puede ser número, string, o notación científica.
 * Previene problemas como `5.4911e+12` en teléfonos o cédulas con ceros a la izquierda.
 */
function sanitizeCellValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';

  // Si es número (Excel almacena teléfonos y cédulas como floats)
  if (typeof raw === 'number') {
    // Convertir a entero si no tiene decimales significativos
    const asInt = Math.round(raw);
    return String(asInt);
  }

  return String(raw).trim();
}

/**
 * Procesa un lote (chunk) de filas de Excel y genera sus tokens QR en paralelo.
 * Limitar el tamaño de chunk evita saturar el Event Loop con 500+ Promises simultáneas.
 */
async function processChunk(
  rows: Record<string, unknown>[],
  startIndex: number
): Promise<ImportPreviewItem[]> {
  // Parsear datos de las filas primero (síncrono)
  const parsed = rows.map((row, localIdx) => {
    const idx = startIndex + localIdx;
    let fullName = '';
    let name = '';
    let lastName = '';
    let dni = '';
    let phone = '';
    let email = '';
    let planName = 'Musculación Standard';
    let debtAmount = 0;

    for (const key of Object.keys(row)) {
      const normKey = normalizeHeader(key);
      const val = sanitizeCellValue(row[key]);
      if (!val) continue;

      if (
        normKey.includes('nombre completo') ||
        normKey === 'full name' ||
        normKey === 'cliente' ||
        normKey === 'socio'
      ) {
        fullName = val;
      } else if (normKey === 'nombre' || normKey === 'first name' || normKey === 'nombres') {
        name = val;
      } else if (normKey === 'apellido' || normKey === 'last name' || normKey === 'apellidos') {
        lastName = val;
      } else if (
        normKey.includes('cedula') ||
        normKey.includes('dni') ||
        normKey.includes('identidad') ||
        normKey.includes('documento') ||
        normKey === 'ci'
      ) {
        // Preservar ceros a la izquierda — ya sanitizeCellValue manejó notación científica
        dni = val;
      } else if (
        normKey.includes('telef') ||
        normKey.includes('celular') ||
        normKey.includes('phone') ||
        normKey.includes('whatsapp') ||
        normKey.includes('movil')
      ) {
        phone = val;
      } else if (normKey.includes('email') || normKey.includes('correo')) {
        email = val;
      } else if (normKey.includes('plan') || normKey.includes('membresia')) {
        planName = val;
      } else if (
        normKey.includes('deuda') ||
        normKey.includes('saldo') ||
        normKey.includes('monto')
      ) {
        const parsedDebt = parseFloat(val.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(parsedDebt)) debtAmount = Math.max(0, parsedDebt);
      }
    }

    // Si sólo hay fullName, dividir en nombre y apellido
    if (!name && fullName) {
      const parts = fullName.trim().split(/\s+/);
      name = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    } else if (!name && !fullName && lastName) {
      name = lastName;
      lastName = '';
    }

    if (!name) name = `Cliente_${idx + 1}`;
    if (!dni) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      dni = cleanPhone.length >= 6 ? `TEL-${cleanPhone.slice(-8)}` : `SOC-${1000 + idx}`;
    }

    const isValid = Boolean(name.trim());
    const error = !isValid ? 'Falta el nombre del cliente' : undefined;
    const id = generateUUID();

    return { id, name: name.trim(), lastName: lastName.trim(), dni: dni.trim(), phone, email, planName, debtAmount, isValid, error };
  });

  // Generar todos los tokens QR del chunk en PARALELO con AES-GCM usando el UUID del socio
  const tokens = await Promise.all(
    parsed.map((item) =>
      generateSecureQrToken(item.id)
    )
  );

  return parsed.map((item, i) => ({ ...item, qrToken: tokens[i] }));
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Parsea un archivo Excel o CSV y extrae la lista de clientes con tokens QR firmados.
 * Procesa las filas en chunks de 50 para evitar bloquear la UI en listas grandes.
 */
export async function parseExcelFile(file: File): Promise<ImportPreviewItem[]> {
  const data = await file.arrayBuffer();

  const workbook = XLSX.read(data, {
    type: 'array',
    // Forzar que las celdas numéricas se lean como números reales, no strings
    cellText: false,
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: true, // Mantener valores raw para sanitizaCellValue
  });

  if (jsonRows.length === 0) return [];

  // Dividir en chunks de 50 filas y procesarlos secuencialmente
  // (los tokens dentro de cada chunk se generan en paralelo con Promise.all)
  const CHUNK_SIZE = 50;
  const results: ImportPreviewItem[] = [];

  for (let i = 0; i < jsonRows.length; i += CHUNK_SIZE) {
    const chunk = jsonRows.slice(i, i + CHUNK_SIZE);
    const chunkResults = await processChunk(chunk, i);
    results.push(...chunkResults);

    // Ceder el control al Event Loop entre chunks para mantener la UI responsiva
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return results;
}

/**
 * Descarga una plantilla de Excel (.xlsx) lista para rellenar por el usuario.
 */
export function downloadSampleExcel(): void {
  const sampleData = [
    {
      'Nombre Completo': 'Carlos Silva',
      'Cedula de Identidad': '18492048',
      'Telefono': '+54 9 11 4829-1029',
      'Email': 'carlos.silva@email.com',
      'Plan': 'Pase Total VIP (Mensual)',
      'Saldo Pendiente ($)': 0,
    },
    {
      'Nombre Completo': 'Valentina Rodriguez',
      'Cedula de Identidad': '29481029',
      'Telefono': '+54 9 11 5920-1182',
      'Email': 'v.rodriguez@email.com',
      'Plan': 'Musculación Standard',
      'Saldo Pendiente ($)': 35,
    },
    {
      'Nombre Completo': 'Mariano Gomez',
      'Cedula de Identidad': '32091823',
      'Telefono': '+54 9 11 3910-4492',
      'Email': 'mariano.gomez@email.com',
      'Plan': 'Crossfit & Funcional',
      'Saldo Pendiente ($)': 0,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 22 },
    { wch: 22 },
    { wch: 28 },
    { wch: 25 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Clientes');
  XLSX.writeFile(workbook, 'Plantilla_Socios_Gimnasio.xlsx');
}

/**
 * Exporta todos los socios registrados a un archivo Excel completo.
 */
export function exportMembersToExcel(members: Member[]): void {
  const exportData = members.map((m) => ({
    'ID Socio': m.id,
    'Nombre': m.name,
    'Apellido': m.lastName,
    'Cedula de Identidad / DNI': m.dni,
    'Telefono': m.phone,
    'Email': m.email,
    'Plan Actual': m.planName,
    'Estado': m.debtAmount > 0 ? 'MOROSO' : m.status,
    'Saldo Pendiente ($)': m.debtAmount,
    'Fecha Vencimiento': m.expirationDate,
    'Codigo QR Unico (Token)': m.qrToken,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  worksheet['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
    { wch: 20 }, { wch: 28 }, { wch: 25 }, { wch: 12 },
    { wch: 20 }, { wch: 18 }, { wch: 50 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Socios_Gimnasio');
  XLSX.writeFile(workbook, `BaseDatos_Clientes_Gym_${new Date().toISOString().split('T')[0]}.xlsx`);
}
