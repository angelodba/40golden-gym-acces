import React, { useState } from 'react';
import { Member } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { formatDateLatam } from '../utils/dateUtils';
import { Snowflake, X, Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FreezeMembershipModalProps {
  member: Member;
  onClose: () => void;
  onSuccess: () => void;
}

export const FreezeMembershipModal: React.FC<FreezeMembershipModalProps> = ({
  member,
  onClose,
  onSuccess,
}) => {
  const [freezeDays, setFreezeDays] = useState<number>(7);
  const [reason, setReason] = useState<string>('Vacaciones');
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calcular nueva fecha de vencimiento extendida
  const currentExp = new Date(member.expirationDate);
  const newExpDateObj = new Date(currentExp.getTime() + freezeDays * 24 * 60 * 60 * 1000);
  const newExpDateStr = newExpDateObj.toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);

    try {
      if (isSupabaseConfigured && supabase) {
        // 1. Registrar congelamiento en la tabla `historial_membresias`
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('historial_membresias').insert([
          {
            socio_id: member.id,
            plan_nombre: member.planName,
            fecha_inicio: today,
            fecha_fin: newExpDateStr,
            estado_membresia: 'PAUSADA',
            motivo_pausa: `${reason} (${freezeDays} días congelados)`,
          },
        ]);

        // 2. Extender la fecha de vencimiento en la tabla `socios`
        const { error: updateErr } = await supabase
          .from('socios')
          .update({
            fecha_vencimiento: newExpDateStr,
            estado: 'ACTIVO',
          })
          .eq('id', member.id);

        if (updateErr) throw new Error(updateErr.message);

        // 3. Registrar auditoría del congelamiento
        await supabase.from('auditoria_sistema').insert([
          {
            tabla_afectada: 'socios',
            operacion: 'MEMBRESIA_CONGELADA',
            socio_id: member.id,
            detalles: {
              dias_congelados: freezeDays,
              motivo: reason,
              fecha_vencimiento_anterior: member.expirationDate,
              nueva_fecha_vencimiento: newExpDateStr,
            },
            realizado_por: 'ADMINISTRACION',
          },
        ]);
      }

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al congelar la membresía');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-600 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <Snowflake className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Pausar / Congelar Membresía</h3>
              <p className="text-xs font-bold text-sky-100">{member.name} {member.lastName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info actual */}
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-black text-sky-900">
              <span>Vencimiento Actual:</span>
              <span className="font-mono text-slate-900">{formatDateLatam(member.expirationDate)}</span>
            </div>
            <div className="flex justify-between text-xs font-black text-blue-700">
              <span>Nuevo Vencimiento (+{freezeDays}d):</span>
              <span className="font-mono text-blue-900 font-bold">{formatDateLatam(newExpDateStr)}</span>
            </div>
          </div>

          {/* Días a congelar */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">
              Días de Pausa / Congelamiento:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[7, 14, 21, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setFreezeDays(days)}
                  className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${
                    freezeDays === days
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {days} Días
                </button>
              ))}
            </div>
          </div>

          {/* Motivo de pausa */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
              Motivo de la Pausa:
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-sky-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none"
            >
              <option value="Vacaciones">✈️ Vacaciones</option>
              <option value="Lesión / Salud">🏥 Lesión / Condición de Salud</option>
              <option value="Viaje de Trabajo">💼 Viaje de Trabajo</option>
              <option value="Motivo Personal">👤 Motivo Personal</option>
            </select>
          </div>

          {error && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 border-2 border-slate-300 text-slate-800 font-black py-3 rounded-2xl text-sm hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-black py-3 rounded-2xl text-sm shadow-lg border-2 border-sky-500 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <Snowflake className="w-4 h-4 stroke-[2.5]" /> Aplicar Pausa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
