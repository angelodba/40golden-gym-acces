import { useState, useEffect, useCallback } from 'react';
import { AccessLog } from '../types';
import { getAccessLogs, addAccessLogToStorage } from '../services/supabaseService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LS_KEY = 'fitpass_logs';

export function useAccessLogs() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialLoadOk, setInitialLoadOk] = useState<boolean>(false);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    getAccessLogs()
      .then((loadedLogs) => {
        if (!isMounted) return;
        setLogs(loadedLogs);
        setInitialLoadOk(true);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[useAccessLogs] Error en carga inicial:', err);
        try {
          const saved = localStorage.getItem(LS_KEY);
          if (saved) setLogs(JSON.parse(saved));
        } catch {
          // Ignorar errores de parse
        }
        setLoading(false);
      });

    // Subscripción Realtime de Supabase para monitoreo en vivo (Latencia <30ms)
    let channel: any = null;
    
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'registros_acceso',
          },
          (payload) => {
            if (!isMounted) return;
            const newRecord = payload.new as Record<string, any>;
            
            const newLog: AccessLog = {
              id: newRecord.id,
              memberId: newRecord.socio_id || 'UNKNOWN',
              memberName: newRecord.socio_nombre,
              timestamp: new Date(newRecord.fecha_hora).toLocaleString('es-ES', {
                dateStyle: 'short',
                timeStyle: 'medium',
              }),
              status: newRecord.estado_acceso as 'GRANTED' | 'DENIED',
              reason: newRecord.motivo,
              debtAmount: Number(newRecord.monto_adeudado) || 0,
            };
            
            // Avoid duplicates if the scan originated from this very client
            setLogs((prev) => {
              if (prev.some(log => log.id === newLog.id || Math.abs(new Date(log.timestamp).getTime() - new Date(newLog.timestamp).getTime()) < 1000 && log.memberId === newLog.memberId)) {
                return prev;
              }
              return [newLog, ...prev].slice(0, 200);
            });
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // ── Persistencia guardada en LocalStorage ─────────────────────────────────
  // Solo persiste cuando la carga fue exitosa y hay logs reales
  useEffect(() => {
    if (!loading && initialLoadOk && logs.length > 0) {
      try {
        // Guardar solo los últimos 200 logs para no saturar localStorage
        localStorage.setItem(LS_KEY, JSON.stringify(logs.slice(0, 200)));
      } catch (e) {
        console.warn('[useAccessLogs] No se pudo guardar en localStorage:', e);
      }
    }
  }, [logs, loading, initialLoadOk]);

  const logAccess = useCallback(async (newLog: AccessLog) => {
    setLogs((prev) => [newLog, ...prev]);
    await addAccessLogToStorage(newLog);
  }, []);

  return {
    logs,
    loading,
    logAccess,
  };
}
