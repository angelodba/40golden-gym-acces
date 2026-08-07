import React, { useState, useEffect } from 'react';
import { Member, Currency, PaymentMethod, ExchangeRates } from '../../types';
import {
  getSavedExchangeRates,
  convertFromUSD,
  convertToUSD,
  formatCurrency,
  calculateNewExpirationDate,
} from '../../utils/currencyUtils';
import { formatDateLatam } from '../../utils/dateUtils';
import {
  DollarSign,
  CheckCircle2,
  Loader2,
  ArrowRightLeft,
  Calendar,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickPaymentModalProps {
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

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  Efectivo: <Banknote className="w-4 h-4" />,
  'Pago Móvil': <Smartphone className="w-4 h-4" />,
  Transferencia: <Building2 className="w-4 h-4" />,
  Tarjeta: <CreditCard className="w-4 h-4" />,
};

const RENEWAL_OPTIONS = [
  { days: 15, label: '15 Días' },
  { days: 30, label: '1 Mes' },
  { days: 60, label: '2 Meses' },
  { days: 90, label: '3 Meses' },
];

export const QuickPaymentModal: React.FC<QuickPaymentModalProps> = ({
  member,
  onClose,
  onPaymentSuccess,
}) => {
  const [rates] = useState<ExchangeRates>(getSavedExchangeRates());
  const [currency, setCurrency] = useState<Currency>('USD');
  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  const [renewalDays, setRenewalDays] = useState<number>(30);
  const [amountUSDInput, setAmountUSDInput] = useState<string>(
    (member.debtAmount > 0 ? member.debtAmount : 30).toString()
  );
  const [originalAmountInput, setOriginalAmountInput] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'renew'>(
    member.debtAmount > 0 ? 'full' : 'renew'
  );

  useEffect(() => {
    const usd = parseFloat(amountUSDInput) || 0;
    const converted = convertFromUSD(usd, currency, rates);
    setOriginalAmountInput(
      currency === 'COP' ? Math.round(converted).toString() : converted.toFixed(2)
    );
  }, [currency, rates]);

  const handleOriginalAmountChange = (val: string) => {
    setOriginalAmountInput(val);
    const orig = parseFloat(val) || 0;
    const usd = convertToUSD(orig, currency, rates);
    setAmountUSDInput(usd.toFixed(2));
  };

  const quickAmounts =
    member.debtAmount > 0
      ? [
          { label: 'Deuda Total', usd: member.debtAmount },
          { label: 'Cuota + Deuda', usd: member.debtAmount + 30 },
          { label: '$30', usd: 30 },
        ]
      : [
          { label: '$30 / 1 Mes', usd: 30 },
          { label: '$60 / 2 Meses', usd: 60 },
          { label: '$90 / 3 Meses', usd: 90 },
        ];

  const setQuickAmount = (usd: number) => {
    setAmountUSDInput(usd.toString());
    const converted = convertFromUSD(usd, currency, rates);
    setOriginalAmountInput(
      currency === 'COP' ? Math.round(converted).toString() : converted.toFixed(2)
    );
  };

  const parsedUSD = parseFloat(amountUSDInput) || 0;
  const parsedOriginal = parseFloat(originalAmountInput) || 0;
  const currentRate = currency === 'VES' ? rates.VES : currency === 'COP' ? rates.COP : 1;
  const nextExpDate = calculateNewExpirationDate(member.expirationDate, renewalDays);
  const newDebt = Math.max(0, member.debtAmount - parsedUSD);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedUSD <= 0) return;
    setError(null);
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
      confetti({ particleCount: 100, spread: 90, origin: { y: 0.55 }, colors: ['#10b981', '#34d399', '#6ee7b7'] });
      onClose();
    } catch (err) {
      setError('Error al registrar el cobro. Verifique la conexión y vuelva a intentarlo.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <DollarSign className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Cobro Rápido</h3>
              <p className="text-xs font-bold text-emerald-100">{member.name} {member.lastName} · C.I. {member.dni}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Deuda */}
          {member.debtAmount > 0 && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-rose-500 uppercase tracking-wider block">Saldo Adeudado</span>
                <span className="text-2xl font-black text-rose-600">${member.debtAmount.toFixed(2)} USD</span>
                <span className="text-xs font-bold text-rose-400 block mt-0.5">
                  {formatCurrency(member.debtAmount, 'VES', rates)} · {formatCurrency(member.debtAmount, 'COP', rates)}
                </span>
              </div>
              <img src={member.avatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-200 shadow-sm" />
            </div>
          )}

          {/* Tipo de operación */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Tipo de Operación:</label>
            <div className="grid grid-cols-3 gap-2">
              {member.debtAmount > 0 && (
                <button type="button"
                  onClick={() => { setPaymentType('full'); setQuickAmount(member.debtAmount); }}
                  className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${paymentType === 'full' ? 'bg-rose-600 text-white border-rose-500' : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'}`}>
                  Saldar Deuda
                </button>
              )}
              <button type="button"
                onClick={() => setPaymentType('partial')}
                className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${paymentType === 'partial' ? 'bg-amber-500 text-white border-amber-400' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'}`}>
                Abono Parcial
              </button>
              <button type="button"
                onClick={() => { setPaymentType('renew'); setQuickAmount(30); }}
                className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${paymentType === 'renew' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}>
                Renovar Plan
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Montos Rápidos */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Montos Rápidos:</label>
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((qa) => (
                  <button key={qa.label} type="button" onClick={() => setQuickAmount(qa.usd)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border-2 border-slate-200 hover:border-emerald-300 text-slate-700 font-black text-xs rounded-xl transition-all">
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Moneda */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Moneda:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['USD', 'VES', 'COP'] as const).map((curr) => (
                  <button key={curr} type="button" onClick={() => setCurrency(curr)}
                    className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all ${currency === curr ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                    {curr === 'USD' ? '💵 USD ($)' : curr === 'VES' ? '🇻🇪 Bolívares' : '🇨🇴 Pesos COP'}
                  </button>
                ))}
              </div>
            </div>

            {/* Montos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Monto en {currency}:</label>
                <input type="number" step="0.01" min="0.01" required value={originalAmountInput}
                  onChange={(e) => handleOriginalAmountChange(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 rounded-2xl px-4 py-3 text-base font-black text-slate-900 focus:outline-none font-mono" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">Equivalente USD $:</label>
                <input type="number" step="0.01" min="0.01" required value={amountUSDInput}
                  onChange={(e) => {
                    setAmountUSDInput(e.target.value);
                    const usd = parseFloat(e.target.value) || 0;
                    const c = convertFromUSD(usd, currency, rates);
                    setOriginalAmountInput(currency === 'COP' ? Math.round(c).toString() : c.toFixed(2));
                  }}
                  className="w-full bg-emerald-50 border-2 border-emerald-400 rounded-2xl px-4 py-3 text-base font-black text-emerald-800 focus:outline-none font-mono" />
              </div>
            </div>

            {currency !== 'USD' && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" /> Tasa: 1 USD =</span>
                <span className="font-mono font-black text-slate-900">{currency === 'VES' ? `${rates.VES} Bs.` : `${rates.COP.toLocaleString()} COP`}</span>
              </div>
            )}

            {/* Resultado */}
            {parsedUSD > 0 && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Nuevo saldo deudor:</span>
                <span className={`text-sm font-black ${newDebt === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ${newDebt.toFixed(2)} USD
                </span>
              </div>
            )}

            {/* Método */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Método de Pago:</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Efectivo', 'Pago Móvil', 'Transferencia', 'Tarjeta'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)}
                    className={`py-2.5 rounded-xl text-xs font-black border-2 transition-all flex items-center justify-center gap-1.5 ${method === m ? 'bg-slate-900 text-white border-slate-900 shadow' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {METHOD_ICONS[m]} {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Renovación */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Renovación:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RENEWAL_OPTIONS.map((opt) => (
                  <button key={opt.days} type="button" onClick={() => setRenewalDays(opt.days)}
                    className={`py-2 rounded-xl text-xs font-black border-2 transition-all ${renewalDays === opt.days ? 'bg-emerald-600 text-white border-emerald-500 shadow' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs font-bold text-emerald-700 mt-2 text-center">
                Nueva fecha: <strong className="font-mono text-slate-900">{formatDateLatam(nextExpDate)}</strong>
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 text-xs font-bold text-rose-700">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={processing}
                className="flex-1 bg-slate-100 border-2 border-slate-300 text-slate-800 font-black py-3 rounded-2xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={processing || parsedUSD <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-sm shadow-lg border-2 border-emerald-500 flex items-center justify-center gap-2 transition-all active:scale-95">
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 stroke-[3]" /> Confirmar Cobro</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
