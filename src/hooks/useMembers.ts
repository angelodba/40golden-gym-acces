import { useState, useEffect, useCallback } from 'react';
import { Member } from '../types';
import {
  getMembers,
  addMemberToStorage,
  addMembersBatchToStorage,
  processPayment,
  mapRowToMember,
} from '../services/supabaseService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LS_KEY = 'fitpass_members';

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Rastrear si la carga inicial fue exitosa para proteger LocalStorage
  const [initialLoadOk, setInitialLoadOk] = useState<boolean>(false);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    getMembers()
      .then((loadedMembers) => {
        if (!isMounted) return;
        setMembers(loadedMembers);
        // Solo marcar como exitoso si realmente hay datos o si Supabase respondió sin error
        setInitialLoadOk(true);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[useMembers] Error en carga inicial, usando datos locales:', err);
        // Intentar recuperar desde LocalStorage como fallback de emergencia
        try {
          const saved = localStorage.getItem(LS_KEY);
          if (saved) setMembers(JSON.parse(saved));
        } catch {
          // Ignorar errores de parse de localStorage
        }
        setLoading(false);
        // No marcar initialLoadOk para proteger los datos locales
      });

    // Subscripción en tiempo real a la tabla 'socios' de Supabase
    let channel: any = null;

    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('socios-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'socios',
          },
          (payload) => {
            if (!isMounted) return;
            const eventType = payload.eventType;

            if (eventType === 'INSERT' && payload.new) {
              const newMem = mapRowToMember(payload.new as Record<string, unknown>);
              setMembers((prev) => {
                if (prev.some((m) => m.id === newMem.id || m.dni === newMem.dni)) return prev;
                return [newMem, ...prev];
              });
            } else if (eventType === 'UPDATE' && payload.new) {
              const updatedMem = mapRowToMember(payload.new as Record<string, unknown>);
              setMembers((prev) =>
                prev.map((m) => (m.id === updatedMem.id || m.dni === updatedMem.dni ? updatedMem : m))
              );
            } else if (eventType === 'DELETE' && payload.old) {
              const oldId = (payload.old as Record<string, unknown>).id;
              setMembers((prev) => prev.filter((m) => m.id !== oldId));
            }
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

  // ── Persistencia en LocalStorage ─────────────────────────────────────────
  // SEGURIDAD: Solo escribe en localStorage cuando:
  //   1. La carga inicial terminó (loading === false)
  //   2. La carga fue exitosa (initialLoadOk === true)
  //   3. Hay datos reales (members.length > 0)
  // Esto previene sobreescribir datos locales con un array vacío si Supabase falla.
  useEffect(() => {
    if (!loading && initialLoadOk && members.length > 0) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(members));
      } catch (e) {
        console.warn('[useMembers] No se pudo guardar en localStorage:', e);
      }
    }
  }, [members, loading, initialLoadOk]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const addMember = useCallback(async (newMember: Member): Promise<Member> => {
    const savedMember = await addMemberToStorage(newMember);
    setMembers((prev) => [savedMember, ...prev]);
    return savedMember;
  }, []);

  const addMembersBatch = useCallback(async (newMembersBatch: Member[]): Promise<Member[]> => {
    if (newMembersBatch.length === 0) return [];
    const savedMembers = await addMembersBatchToStorage(newMembersBatch);
    setMembers((prev) => [...savedMembers, ...prev]);
    return savedMembers;
  }, []);

  const handlePaymentSuccess = useCallback(
    async (
      memberId: string,
      amountPaid: number,
      method: 'Efectivo' | 'Tarjeta' | 'Transferencia'
    ): Promise<void> => {
      const result = await processPayment(memberId, amountPaid, method);

      setMembers((prev) =>
        prev.map((m) => {
          if (m.id !== memberId) return m;
          const newDebt = Math.max(0, m.debtAmount - amountPaid);
          return {
            ...m,
            debtAmount: newDebt,
            status: newDebt === 0 ? 'ACTIVE' : 'DEBTOR',
            expirationDate: result.newExpirationDate || m.expirationDate,
          };
        })
      );
    },
    []
  );

  return {
    members,
    loading,
    addMember,
    addMembersBatch,
    handlePaymentSuccess,
  };
}
