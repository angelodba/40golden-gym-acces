import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Member, AccessLog, Currency, PaymentMethod } from '../types';
import { initialMembers, initialLogs } from '../data/mockData';
import { verifySecureQRToken } from '../lib/crypto';
import { getMemberAvatarUrl } from '../utils/avatarUtils';

const LOCAL_STORAGE_MEMBERS_KEY = 'fitpass_members';
const LOCAL_STORAGE_LOGS_KEY = 'fitpass_logs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

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
      .limit(500);

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
        .upsert([record], { onConflict: 'dni' })
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

/**
 * Registrar un lote de socios en la base de datos de Supabase.
 * Procesa en micro-lotes de 50 registros con upsert (por DNI) para resiliencia total.
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

  const CHUNK_SIZE = 50;
  const results: Member[] = [];

  for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
    const chunkRecords = recordsToInsert.slice(i, i + CHUNK_SIZE);
    const chunkMembers = newMembers.slice(i, i + CHUNK_SIZE);

    try {
      const { data, error } = await supabase
        .from('socios')
        .upsert(chunkRecords, { onConflict: 'dni' })
        .select();

      if (!error && data) {
        data.forEach((item, index) => {
          results.push({
            ...chunkMembers[index],
            id: item.id as string,
          });
        });
      } else {
        console.warn('[supabaseService] Upsert por lote con advertencia, insertando uno por uno:', error?.message);
        for (const [idx, record] of chunkRecords.entries()) {
          try {
            const { data: singleData } = await supabase
              .from('socios')
              .upsert([record], { onConflict: 'dni' })
              .select()
              .single();

            if (singleData) {
              results.push({ ...chunkMembers[idx], id: singleData.id as string });
            } else {
              results.push(chunkMembers[idx]);
            }
          } catch {
            results.push(chunkMembers[idx]);
          }
        }
      }
    } catch (err) {
      console.error('[supabaseService] Error insertando micro-lote Excel:', err);
      results.push(...chunkMembers);
    }
  }

  return results;
}

// ─── Verificación QR ──────────────────────────────────────────────────────────

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
              avatarUrl: getMemberAvatarUrl(data.member.name, data.member.lastName, data.member.avatarUrl),
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
    // Silenciar fallo si no era AES-GCM
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
            avatarUrl: getMemberAvatarUrl(data.member.name, data.member.lastName, data.member.avatarUrl),
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

export async function processPayment(
  memberId: string,
  amountUSD: number,
  method: PaymentMethod,
  currency: Currency = 'USD',
  amountOriginal?: number,
  exchangeRate?: number,
  daysExtension: number = 30
): Promise<{ success: boolean; newDebt: number; newExpirationDate: string }> {
  const nextExpDate = new Date(Date.now() + daysExtension * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  if (isSupabaseConfigured && supabase && isUuid(memberId)) {
    try {
      const { data, error } = await supabase.rpc('registrar_pago_socio', {
        p_socio_id: memberId,
        p_monto: amountUSD,
        p_metodo_pago: method,
      });

      // Registrar historial en la tabla de pagos
      try {
        await supabase
          .from('pagos')
          .insert([
            {
              socio_id: memberId,
              monto_usd: amountUSD,
              monto_original: amountOriginal || amountUSD,
              moneda: currency,
              tasa_cambio: exchangeRate || 1,
              metodo_pago: method,
              fecha_vencimiento_resultante: nextExpDate,
            },
          ]);
      } catch (e: any) {
        console.warn('[supabaseService] No se pudo guardar en tabla pagos:', e?.message);
      }

      if (!error && data?.success) {
        return {
          success: true,
          newDebt: Number(data.newDebt) || 0,
          newExpirationDate: (data.newExpirationDate as string) || nextExpDate,
        };
      }

      if (error) {
        console.error('[supabaseService] processPayment RPC error:', error.message);
      }
    } catch (err) {
      console.warn('[supabaseService] processPayment excepción:', err);
    }
  }

  return { success: true, newDebt: 0, newExpirationDate: nextExpDate };
}
