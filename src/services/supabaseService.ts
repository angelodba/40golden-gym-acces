import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Member, AccessLog } from '../types';
import { initialMembers, initialLogs } from '../data/mockData';
import { verifySecureQRToken } from '../lib/crypto';

const LOCAL_STORAGE_MEMBERS_KEY = 'fitpass_members';
const LOCAL_STORAGE_LOGS_KEY = 'fitpass_logs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

import { getMemberAvatarUrl } from '../utils/avatarUtils';

/** Mapea una fila de la tabla 'socios' al tipo Member del frontend */
export function mapRowToMember(item: Record<string, unknown>): Member {
  const name = (item.nombre as string) || '';
  const lastName = (item.apellido as string) || '';
  return {
    id: item.id as string,
    qrToken: item.qr_token as string,
    name,
    lastName,
    dni: item.dni as string,
    phone: (item.telefono as string) || '',
    email: (item.email as string) || '',
    status:
      Number(item.saldo_pendiente) > 0
        ? 'DEBTOR'
        : item.estado === 'VENCIDO'
        ? 'EXPIRED'
        : 'ACTIVE',
    debtAmount: Number(item.saldo_pendiente) || 0,
    expirationDate: item.fecha_vencimiento as string,
    avatarUrl: getMemberAvatarUrl(name, lastName, item.foto_url as string),
    planName: (item.plan_nombre as string) || 'Musculación Standard',
  };
}

/**
 * Limpiar o purgar el historial de accesos (en Supabase y LocalStorage).
 */
export async function clearAccessLogsInStorage(): Promise<void> {
  localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('registros_acceso')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.warn('[supabaseService] Error al purgar registros_acceso en Supabase:', error.message);
      }
    } catch (err) {
      console.error('[supabaseService] Excepción al purgar registros_acceso:', err);
    }
  }
}

// ─── Socios ───────────────────────────────────────────────────────────────────

/**
 * Obtener todos los socios registrados (Supabase o Fallback Local).
 * Lanza error si Supabase falla para que el hook pueda manejarlo.
 */
export async function getMembers(): Promise<Member[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('socios')
      .select('*')
      .order('creado_en', { ascending: false });

    if (error) {
      console.warn('[supabaseService] getMembers error:', error.message);
      throw new Error(error.message);
    }

    if (data) return data.map(mapRowToMember);
  }

  // Fallback LocalStorage
  const saved = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
  return saved ? (JSON.parse(saved) as Member[]) : initialMembers;
}

/**
 * Obtener historial de registros de acceso (Supabase o Fallback Local).
 */
export async function getAccessLogs(): Promise<AccessLog[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('registros_acceso')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('[supabaseService] getAccessLogs error:', error.message);
      throw new Error(error.message);
    }

    if (data) {
      return data.map((item) => ({
        id: item.id as string,
        memberId: (item.socio_id as string) || 'UNKNOWN',
        memberName: item.socio_nombre as string,
        timestamp: new Date(item.fecha_hora as string).toLocaleString('es-ES', {
          dateStyle: 'short',
          timeStyle: 'medium',
        }),
        status: item.estado_acceso as 'GRANTED' | 'DENIED',
        reason: item.motivo as string,
        debtAmount: Number(item.monto_adeudado) || 0,
      }));
    }
  }

  const saved = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
  return saved ? (JSON.parse(saved) as AccessLog[]) : initialLogs;
}

/**
 * Persistir un registro de acceso (GRANTED o DENIED) en la tabla 'registros_acceso' de Supabase.
 */
export async function addAccessLogToStorage(log: AccessLog): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      const record: Record<string, unknown> = {
        socio_nombre: log.memberName,
        estado_acceso: log.status,
        motivo: log.reason,
        monto_adeudado: log.debtAmount || 0,
        fecha_hora: new Date().toISOString(),
      };

      if (log.memberId && log.memberId !== 'UNKNOWN' && isUuid(log.memberId)) {
        record.socio_id = log.memberId;
      }

      const { error } = await supabase
        .from('registros_acceso')
        .insert([record]);

      if (error) {
        console.error('[supabaseService] Error guardando registro de acceso en Supabase:', error.message);
      }
    } catch (err) {
      console.error('[supabaseService] Excepción en addAccessLogToStorage:', err);
    }
  }
}

/**
 * Registrar un nuevo socio individual.
 */
export async function addMemberToStorage(newMember: Member): Promise<Member> {
  if (isSupabaseConfigured && supabase) {
    try {
      const record: Record<string, unknown> = {
        qr_token: newMember.qrToken,
        nombre: newMember.name,
        apellido: newMember.lastName,
        dni: newMember.dni,
        telefono: newMember.phone,
        email: newMember.email,
        estado: newMember.debtAmount > 0 ? 'MOROSO' : 'ACTIVO',
        saldo_pendiente: newMember.debtAmount,
        fecha_vencimiento: newMember.expirationDate,
        plan_nombre: newMember.planName,
        foto_url: newMember.avatarUrl,
      };

      if (isUuid(newMember.id)) {
        record.id = newMember.id;
      }

      const { data, error } = await supabase
        .from('socios')
        .insert([record])
        .select()
        .single();

      if (error) {
        console.error('[supabaseService] addMemberToStorage error:', error.message, error.details);
      } else if (data) {
        return mapRowToMember(data);
      }
    } catch (err) {
      console.error('[supabaseService] addMemberToStorage excepción:', err);
    }
  }

  return newMember;
}

export interface BatchInsertResult {
  /** Socios que se insertaron exitosamente (con ID de BD actualizado) */
  inserted: Member[];
  /** Socios que fallaron (duplicados u otros errores), conservados con ID local */
  failed: Member[];
}

/**
 * Registrar un lote de socios en la base de datos con manejo granular de errores.
 * Si falla la inserción masiva, intenta insertar uno por uno para aislar duplicados.
 */
export async function addMembersBatchToStorage(newMembers: Member[]): Promise<Member[]> {
  if (!isSupabaseConfigured || !supabase || newMembers.length === 0) {
    return newMembers;
  }

  const recordsToInsert = newMembers.map((m) => {
    const rec: Record<string, unknown> = {
      qr_token: m.qrToken,
      nombre: m.name,
      apellido: m.lastName,
      dni: m.dni,
      telefono: m.phone,
      email: m.email,
      estado: m.debtAmount > 0 ? 'MOROSO' : 'ACTIVO',
      saldo_pendiente: m.debtAmount,
      fecha_vencimiento: m.expirationDate,
      plan_nombre: m.planName,
      foto_url: m.avatarUrl,
    };
    if (isUuid(m.id)) {
      rec.id = m.id;
    }
    return rec;
  });

  // Intento 1: inserción masiva
  try {
    const { data, error } = await supabase
      .from('socios')
      .insert(recordsToInsert)
      .select();

    if (!error && data) {
      return data.map((item, index) => ({
        ...newMembers[index],
        id: item.id as string,
      }));
    }

    if (error) {
      console.warn(
        '[supabaseService] Batch insert falló (posibles duplicados). Intentando inserción individual...',
        error.code,
        error.message
      );
    }
  } catch (err) {
    console.error('[supabaseService] Batch insert excepción:', err);
  }

  // Intento 2: insertar uno por uno para aislar cuáles fallan
  const results: Member[] = [];

  for (const [index, record] of recordsToInsert.entries()) {
    try {
      const { data, error } = await supabase
        .from('socios')
        .insert([record])
        .select()
        .single();

      if (!error && data) {
        results.push({ ...newMembers[index], id: data.id as string });
      } else {
        console.warn(
          `[supabaseService] Socio omitido (DNI: ${record.dni}):`,
          error?.message || 'desconocido'
        );
        results.push(newMembers[index]);
      }
    } catch (err) {
      console.error(`[supabaseService] Error insertando socio ${record.dni}:`, err);
      results.push(newMembers[index]);
    }
  }

  return results;
}

// ─── Verificación QR ──────────────────────────────────────────────────────────

/**
 * Validar Token QR mediante función RPC en Supabase o Lógica Criptográfica Local.
 */
export async function verifyAccess(
  token: string,
  localMembers: Member[]
): Promise<{ status: 'GRANTED' | 'DENIED'; reason: string; member?: Member; timestamp: string }> {
  const nowStr = new Date().toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const cleanToken = token.trim();

  // A. Intentar desencriptar payload AES-GCM (dinámico, sin PII, con Anti-Replay)
  try {
    const payload = await verifySecureQRToken(cleanToken);
    if (payload && payload.userId) {
      // Si Supabase está configurado, invocar la función RPC almacenada con Nonce Anti-Replay
      if (isSupabaseConfigured && supabase && isUuid(payload.userId)) {
        const { data, error } = await supabase.rpc('verificar_acceso_seguro', {
          p_socio_id: payload.userId,
          p_nonce: payload.nonce,
        });

        if (!error && data) {
          return {
            status: data.status,
            reason: data.reason,
            member: data.member ? {
              id: data.member.id,
              qrToken: cleanToken,
              name: data.member.name,
              lastName: data.member.lastName,
              dni: data.member.dni,
              phone: '',
              email: '',
              status: Number(data.member.debtAmount) > 0 ? 'DEBTOR' : 'ACTIVE',
              debtAmount: Number(data.member.debtAmount) || 0,
              expirationDate: data.member.expirationDate,
              avatarUrl: data.member.avatarUrl,
              planName: data.member.planName,
            } : undefined,
            timestamp: data.timestamp || nowStr,
          };
        }
      }

      // Fallback local para token AES-GCM desencriptado
      const member = localMembers.find((m) => m.id === payload.userId);
      if (member) {
        if (member.debtAmount > 0 || member.status === 'DEBTOR') {
          return {
            status: 'DENIED',
            reason: `ACCESO DENEGADO - Saldo pendiente adeudado ($${member.debtAmount.toFixed(2)})`,
            member,
            timestamp: nowStr,
          };
        }
        if (member.status === 'EXPIRED') {
          return {
            status: 'DENIED',
            reason: `ACCESO DENEGADO - Cuota vencida el ${member.expirationDate}`,
            member,
            timestamp: nowStr,
          };
        }
        return {
          status: 'GRANTED',
          reason: '¡PUEDE PASAR! Cuota al día',
          member,
          timestamp: nowStr,
        };
      }
    }
  } catch (err: any) {
    // Si el error fue por expiración o firma inválida de AES-GCM
    if (err?.message?.includes('expired')) {
      return {
        status: 'DENIED',
        reason: 'Código QR expirado (Excedió ventana de seguridad de 30s)',
        timestamp: nowStr,
      };
    }
  }

  // B. Si Supabase está configurado, probar RPC `verificar_acceso_qr`
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('verificar_acceso_qr', {
        p_qr_token: cleanToken,
      });

      if (!error && data) {
        return {
          status: data.status,
          reason: data.reason,
          member: data.member ? {
            id: data.member.id,
            qrToken: cleanToken,
            name: data.member.name,
            lastName: data.member.lastName,
            dni: data.member.dni,
            phone: '',
            email: '',
            status: Number(data.member.debtAmount) > 0 ? 'DEBTOR' : 'ACTIVE',
            debtAmount: Number(data.member.debtAmount) || 0,
            expirationDate: data.member.expirationDate,
            avatarUrl: data.member.avatarUrl,
            planName: data.member.planName,
          } : undefined,
          timestamp: data.timestamp || nowStr,
        };
      }
    } catch (err) {
      console.warn('[supabaseService] Error ejecutando RPC verificar_acceso_qr:', err);
    }
  }

  // C. Fallback Directo de Búsqueda Local por qrToken, DNI o ID
  const cleanDni = cleanToken.replace(/^V-?/i, '');
  const foundMember = localMembers.find(
    (m) =>
      m.qrToken === cleanToken ||
      m.dni === cleanToken ||
      m.dni === cleanDni ||
      m.id === cleanToken
  );

  if (!foundMember) {
    return {
      status: 'DENIED',
      reason: 'Código QR o C.I. no registrado en la base de datos',
      timestamp: nowStr,
    };
  }

  if (foundMember.debtAmount > 0 || foundMember.status === 'DEBTOR') {
    return {
      status: 'DENIED',
      reason: `ACCESO DENEGADO - Saldo pendiente adeudado ($${foundMember.debtAmount.toFixed(2)})`,
      member: foundMember,
      timestamp: nowStr,
    };
  }

  if (foundMember.status === 'EXPIRED') {
    return {
      status: 'DENIED',
      reason: `ACCESO DENEGADO - Cuota vencida el ${foundMember.expirationDate}`,
      member: foundMember,
      timestamp: nowStr,
    };
  }

  return {
    status: 'GRANTED',
    reason: '¡PUEDE PASAR! Cuota al día',
    member: foundMember,
    timestamp: nowStr,
  };
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

/**
 * Procesar Cobro y Renovar Membresía (Transacción Atómica RPC).
 */
export async function processPayment(
  memberId: string,
  amount: number,
  method: 'Efectivo' | 'Tarjeta' | 'Transferencia'
): Promise<{ success: boolean; newDebt: number; newExpirationDate: string }> {
  // Solo llamar RPC si el ID es un UUID real de Supabase
  if (isSupabaseConfigured && supabase && isUuid(memberId)) {
    try {
      const { data, error } = await supabase.rpc('registrar_pago_socio', {
        p_socio_id: memberId,
        p_monto: amount,
        p_metodo_pago: method,
      });

      if (!error && data?.success) {
        return {
          success: true,
          newDebt: Number(data.newDebt) || 0,
          newExpirationDate: data.newExpirationDate as string,
        };
      }

      if (error) {
        console.error('[supabaseService] processPayment RPC error:', error.message);
      }
    } catch (err) {
      console.warn('[supabaseService] processPayment excepción:', err);
    }
  }

  // Fallback local — calcular nueva fecha localmente
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  return { success: true, newDebt: 0, newExpirationDate: nextMonth };
}
