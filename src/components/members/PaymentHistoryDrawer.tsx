import React, { useState, useEffect, useCallback } from 'react';
import { Member } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { formatCurrency, getSavedExchangeRates } from '../../utils/currencyUtils';
import { formatDateLatam, formatDateTimeLatam } from '../../utils/dateUtils';
import {
  X,
  History,
  Receipt,
  Loader2,
  AlertCircle,
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
  TrendingDown,
} from 'lucide-react';

interface PaymentRecord {
  id: string;
  monto: number;
  monto_original?: number;
  moneda?: string;
  tasa_cambio?: number;
  metodo_pago: string;
  concepto: string;
  fecha_vencimiento_resultante?: string;
  fecha_pago: string;
}

interface PaymentHistoryDrawerProps {
  member: Member;
  onClose: () => void;
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  Efectivo: <Banknote className="w-4 h-4 text-emerald-600" />,
  'Pago Móvil': <Smartphone className="w-4 h-4 text-blue-600" />,
  Transferencia: <Building2 className="w-4 h-4 text-purple-600" />,
  Tarjeta: <CreditCard className="w-4 h-4 text-amber-600" />,
};

export const PaymentHistoryDrawer: React.FC<PaymentHistoryDrawerProps> = ({ member, onClose }) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rates = getSavedExchangeRates();

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: err } = await supabase
          .from('pagos')
          .select('*')
          .eq('socio_id', member.id)
          .order('fecha_pago', { ascending: false });

        if (err) throw new Error(err.message);
        setPayments((data as PaymentRecord[]) || []);
      } else {
        setPayments([]);
      }
    } catch (e: any) {
      setError('No se pudo obtener el historial de pagos. ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [member.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalPaid = payments.reduce((acc, p) => acc + (p.monto || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4 z-50">
      <div className="bg-white border-2 border-slate-200 rounded-t-3xl sm:rounded-3xl w-full sm:w-96 max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b-2 border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl">
              <History className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Historial de Cobros</h3>
              <p className="text-xs font-bold text-slate-500">{member.name} {member.lastName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Resumen */}
        <div className="px-5 py-4 bg-indigo-50 border-b-2 border-indigo-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-indigo-500 uppercase tracking-wider">Total Cobrado Históricamente</p>
              <p className="text-2xl font-black text-indigo-700">${totalPaid.toFixed(2)} USD</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-indigo-500">{payments.length} transacciones</p>
              <p className="text-xs font-bold text-rose-500 mt-0.5">Saldo actual: ${member.debtAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Lista de Pagos */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-bold">Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-rose-500">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-sm font-bold text-center">{error}</p>
              <button onClick={fetchPayments} className="mt-3 px-4 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs rounded-xl">Reintentar</button>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <TrendingDown className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-bold">Sin cobros registrados aún</p>
            </div>
          ) : (
            payments.map((payment) => {
              const fecha = new Date(payment.fecha_pago);
              const isMulticurrency = payment.moneda && payment.moneda !== 'USD' && payment.monto_original;
              return (
                <div key={payment.id} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 hover:border-indigo-200 transition-colors group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {METHOD_ICON[payment.metodo_pago] || <Receipt className="w-4 h-4 text-slate-500" />}
                      <span className="text-xs font-black text-slate-700">{payment.metodo_pago || 'Pago'}</span>
                    </div>
                    <span className="text-base font-black text-emerald-600">${(payment.monto || 0).toFixed(2)} USD</span>
                  </div>

                  {isMulticurrency && (
                    <p className="text-xs font-bold text-slate-500 mb-1.5 font-mono">
                      Pagado: {payment.monto_original?.toLocaleString()} {payment.moneda}
                      {payment.tasa_cambio ? ` · Tasa: ${payment.tasa_cambio}` : ''}
                    </p>
                  )}

                  <p className="text-xs font-bold text-slate-500 mb-2 leading-relaxed">{payment.concepto}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400">
                      {formatDateTimeLatam(payment.fecha_pago)}
                    </span>
                    {payment.fecha_vencimiento_resultante && (
                      <span className="text-[11px] font-bold text-emerald-600 font-mono">
                        Hasta: {formatDateLatam(payment.fecha_vencimiento_resultante)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-slate-100 shrink-0">
          <button onClick={onClose}
            className="w-full bg-slate-100 border-2 border-slate-300 text-slate-800 font-black py-3 rounded-2xl text-sm hover:bg-slate-200 transition-colors">
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};
