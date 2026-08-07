import React, { useState, useEffect } from 'react';
import { Member, Currency, PaymentMethod, ExchangeRates } from '../types';
import { getSavedExchangeRates, convertFromUSD, convertToUSD, formatCurrency, calculateNewExpirationDate } from '../utils/currencyUtils';
import { DollarSign, CheckCircle2, Sparkles, Loader2, ArrowRightLeft, Calendar, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentModalProps {
  member: Member;
  onClose: () => void;
  onPaymentSuccess: (
    memberId: string,
    amountPaidUSD: number,
    method: PaymentMethod,
    currency?: Currency,
    amountOriginal?: number,
    exchangeRate?: number,
    daysExtension?: number
  ) => Promise<void> | void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  member,
  onClose,
  onPaymentSuccess,
}) => {
  const [rates, setRates] = useState<ExchangeRates>(getSavedExchangeRates());
  const [currency, setCurrency] = useState<Currency>('USD');
  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  const [renewalDays, setRenewalDays] = useState<number>(30);

  // Valor base en USD (default a la deuda o $30 si no debe nada)
  const defaultUSD = member.debtAmount > 0 ? member.debtAmount : 30;
  const [amountUSDInput, setAmountUSDInput] = useState<string>(defaultUSD.toString());
  const [originalAmountInput, setOriginalAmountInput] = useState<string>('');

  const [processing, setProcessing] = useState<boolean>(false);

  // Al cambiar moneda o USD input, sincronizar el valor original
  useEffect(() => {
    const usd = parseFloat(amountUSDInput) || 0;
    const converted = convertFromUSD(usd, currency, rates);
    if (currency === 'USD') {
      setOriginalAmountInput(usd.toString());
    } else if (currency === 'VES') {
      setOriginalAmountInput(converted.toFixed(2));
    } else if (currency === 'COP') {
      setOriginalAmountInput(Math.round(converted).toString());
    }
  }, [currency, amountUSDInput, rates]);

  // Al editar el monto en la moneda seleccionada, recalcular USD
  const handleOriginalAmountChange = (val: string) => {
    setOriginalAmountInput(val);
    const orig = parseFloat(val) || 0;
    const usd = convertToUSD(orig, currency, rates);
    setAmountUSDInput(usd.toFixed(2));
  };

  const parsedUSD = parseFloat(amountUSDInput) || 0;
  const parsedOriginal = parseFloat(originalAmountInput) || 0;
  const currentRate = currency === 'VES' ? rates.VES : currency === 'COP' ? rates.COP : 1;
  const nextExpDate = calculateNewExpirationDate(member.expirationDate, renewalDays);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedUSD <= 0) return;

    setProcessing(true);
    try {
      await onPaymentSuccess(
        member.id,
        parsedUSD,
        method,
        currency,
        parsedOriginal,
        currentRate,
        renewalDays
      );
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      onClose();
    } catch (err) {
      console.error('Error procesando pago multi-moneda:', err);
      alert('Ocurrió un error al registrar el cobro. Verifica la conexión a Supabase.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border-4 border-slate-300 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
        
        {/* Header Claro */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 text-white border-2 border-emerald-500 rounded-2xl shadow-lg shadow-emerald-600/30">
              <Coins className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Registrar Cobro Multi-Moneda</h3>
              <p className="text-xs font-bold text-slate-600">Socio: {member.name} {member.lastName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 font-black text-2xl">✕</button>
        </div>

        {/* Tarjeta de Estado del Cliente */}
        <div className="bg-slate-100 border-2 border-slate-300 rounded-2xl p-4 flex items-center justify-between shadow-inner">
          <div>
            <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider">Deuda Pendiente:</span>
            <span className="text-2xl font-black text-rose-600">${member.debtAmount.toFixed(2)} USD</span>
            {member.debtAmount > 0 && (
              <span className="block text-xs font-extrabold text-slate-700 mt-0.5">
                ({formatCurrency(member.debtAmount, 'VES', rates)} / {formatCurrency(member.debtAmount, 'COP', rates)})
              </span>
            )}
          </div>
          <img src={member.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-300 shadow" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector de Moneda de Pago */}
          <div>
            <label className="block text-xs font-black text-slate-900 mb-2 uppercase tracking-wider">
              Seleccionar Moneda de Pago:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['USD', 'VES', 'COP'] as const).map((curr) => (
                <button
                  type="button"
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`py-3 rounded-2xl text-xs sm:text-sm font-black border-2 transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                    currency === curr
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-[1.02]'
                      : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <span>{curr === 'USD' ? '💵 USD ($)' : curr === 'VES' ? '🇻🇪 Bolívares (Bs)' : '🇨🇴 Pesos (COP)'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Campos de Monto y Conversión en Tiempo Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-900 mb-1">
                Monto en {currency}:
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={originalAmountInput}
                onChange={(e) => handleOriginalAmountChange(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-2xl px-4 py-3 text-base font-black text-slate-900 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-900 mb-1">
                Equivalente en USD ($):
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountUSDInput}
                onChange={(e) => {
                  setAmountUSDInput(e.target.value);
                  const usd = parseFloat(e.target.value) || 0;
                  setOriginalAmountInput(convertFromUSD(usd, currency, rates).toFixed(currency === 'COP' ? 0 : 2));
                }}
                className="w-full bg-emerald-50 border-2 border-emerald-400 rounded-2xl px-4 py-3 text-base font-black text-emerald-800 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Tasa de Cambio Utilizada */}
          {currency !== 'USD' && (
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-300 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                Tasa Aplicada (1 USD):
              </span>
              <span className="font-mono font-black text-slate-900">
                {currency === 'VES' ? `${rates.VES} Bs.` : `${rates.COP.toLocaleString()} COP`}
              </span>
            </div>
          )}

          {/* Método de Pago */}
          <div>
            <label className="block text-xs font-black text-slate-900 mb-1.5 uppercase tracking-wider">
              Método de Pago:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Efectivo', 'Pago Móvil', 'Transferencia', 'Tarjeta'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMethod(m as PaymentMethod)}
                  className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${
                    method === m
                      ? 'bg-slate-900 text-white border-slate-900 shadow'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Duración de Renovación de Membresía */}
          <div>
            <label className="block text-xs font-black text-slate-900 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" /> Tiempo de Renovación:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { days: 15, label: '15 Días' },
                { days: 30, label: '1 Mes (30d)' },
                { days: 90, label: '3 Meses (90d)' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.days}
                  onClick={() => setRenewalDays(opt.days)}
                  className={`py-2 rounded-xl text-xs font-black border-2 transition-all ${
                    renewalDays === opt.days
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-emerald-700 mt-2 text-center">
              Nueva Fecha de Vencimiento: <strong className="font-mono text-slate-900 text-sm">{nextExpDate}</strong>
            </p>
          </div>

          {/* Footer de Acciones */}
          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="flex-1 bg-slate-100 border-2 border-slate-300 text-slate-800 font-black py-3 rounded-2xl text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-xs sm:text-sm shadow-xl border-2 border-emerald-500 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" /> Registrar y Habilitar QR
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
