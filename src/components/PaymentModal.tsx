import React, { useState } from 'react';
import { Member } from '../types';
import { DollarSign, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  member: Member;
  onClose: () => void;
  onPaymentSuccess: (memberId: string, amountPaid: number, method: 'Efectivo' | 'Tarjeta' | 'Transferencia') => Promise<void> | void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  member,
  onClose,
  onPaymentSuccess,
}) => {
  const [method, setMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [amount, setAmount] = useState<string>(member.debtAmount.toString());
  const [processing, setProcessing] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseFloat(amount);
    // Guard: prevent negative, zero, or non-numeric payments
    if (isNaN(paid) || paid <= 0) return;
    // Guard: prevent paying more than owed (optional soft warning)
    if (paid > member.debtAmount * 2 && member.debtAmount > 0) {
      const ok = window.confirm(`¿Confirmar pago de $${paid.toFixed(2)}? Supera el doble de la deuda actual.`);
      if (!ok) return;
    }

    setProcessing(true);
    try {
      await onPaymentSuccess(member.id, paid, method);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      onClose();
    } catch (err) {
      console.error('Error procesando pago:', err);
      alert('Ocurrió un error al registrar el cobro. Verifica la conexión a Supabase.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Registrar Cobro de Cuota / Deuda</h3>
              <p className="text-xs text-slate-400">Socio: {member.name} {member.lastName}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Deuda Pendiente Actual:</span>
            <span className="text-xl font-extrabold text-rose-400">${member.debtAmount.toFixed(2)}</span>
          </div>
          <img src={member.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Monto a Cobrar ($):</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Método de Pago:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Efectivo', 'Tarjeta', 'Transferencia'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    method === m
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              Al completar el cobro atómico, la cuenta se marcará <strong>CUOTA AL DÍA</strong> y se renovará la validez del pase QR automáticamente por 30 días.
            </p>
          </div>

          <div className="pt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Cobro & Habilitar QR
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
