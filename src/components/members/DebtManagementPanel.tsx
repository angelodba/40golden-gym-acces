import React, { useState, useMemo, useCallback } from 'react';
import { Member, Currency, PaymentMethod, ExchangeRates } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { getDaysRemaining, getSavedExchangeRates, formatCurrency } from '../../utils/currencyUtils';
import { formatDateLatam } from '../../utils/dateUtils';
import { exportMembersToExcel } from '../../utils/excelUtils';
import { getMemberAvatarUrl } from '../../utils/avatarUtils';
import { QuickPaymentModal } from './QuickPaymentModal';
import { PaymentHistoryDrawer } from './PaymentHistoryDrawer';
import { SendReminderModal } from './SendReminderModal';
import {
  DollarSign,
  AlertTriangle,
  Calendar,
  Send,
  FileSpreadsheet,
  History,
  ShieldCheck,
  Search,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  X,
  Loader2,
  Percent,
} from 'lucide-react';

type DebtFilter = 'ALL' | 'DEBTOR' | 'EXPIRED' | 'EXPIRING' | 'ACTIVE';

interface DebtManagementPanelProps {
  members: Member[];
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

// ── Modal de Ajuste / Condonación de Deuda ────────────────────────────────────
interface DebtAdjustModalProps {
  member: Member;
  onClose: () => void;
  onAdjusted: (memberId: string, newDebt: number) => void;
}

const DebtAdjustModal: React.FC<DebtAdjustModalProps> = ({ member, onClose, onAdjusted }) => {
  const [newDebt, setNewDebt] = useState(member.debtAmount.toString());
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('El motivo de ajuste es obligatorio para el registro de auditoría.');
      return;
    }
    setProcessing(true);
    setError(null);
    const adjusted = Math.max(0, parseFloat(newDebt) || 0);
    const diff = member.debtAmount - adjusted;

    try {
      if (isSupabaseConfigured && supabase) {
        // Actualizar saldo en socios
        await supabase.from('socios').update({
          saldo_pendiente: adjusted,
          estado: adjusted > 0 ? 'MOROSO' : 'ACTIVO',
        }).eq('id', member.id);

        // Registrar en auditoría
        await supabase.from('auditoria_sistema').insert([{
          tabla_afectada: 'socios',
          operacion: 'AJUSTE_DEUDA',
          socio_id: member.id,
          detalles: {
            saldo_anterior: member.debtAmount,
            saldo_nuevo: adjusted,
            monto_condonado: diff,
            motivo: reason,
          },
          realizado_por: 'ADMINISTRACION',
        }]);
      }
      onAdjusted(member.id, adjusted);
      onClose();
    } catch {
      setError('Error al aplicar el ajuste. Verifique la conexión a Supabase.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <ShieldCheck className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Ajuste / Condonación de Deuda</h3>
              <p className="text-xs font-bold text-amber-100">Acción restringida · Requiere motivo obligatorio</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
            <p className="text-xs font-black text-amber-700">Socio: {member.name} {member.lastName}</p>
            <p className="text-xs font-bold text-amber-600">Saldo actual: ${member.debtAmount.toFixed(2)} USD</p>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">Nuevo Saldo Adeudado (USD):</label>
            <input type="number" min="0" step="0.01" value={newDebt}
              onChange={(e) => setNewDebt(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-500 rounded-xl px-4 py-3 text-base font-black text-slate-900 focus:outline-none font-mono" />
            {parseFloat(newDebt) < member.debtAmount && (
              <p className="text-xs font-bold text-amber-600 mt-1">
                Se condona: ${(member.debtAmount - parseFloat(newDebt || '0')).toFixed(2)} USD
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">Motivo de Ajuste <span className="text-rose-500">*</span>:</label>
            <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Descuento administrativo por fidelidad, error en facturación anterior..."
              className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none resize-none" />
          </div>
          {error && <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 text-xs font-bold text-rose-700">{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 border-2 border-slate-200 text-slate-700 font-black py-3 rounded-2xl text-sm">Cancelar</button>
            <button type="submit" disabled={processing}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-sm shadow-lg border-2 border-amber-400 flex items-center justify-center gap-2 transition-all">
              {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando...</> : <><ShieldCheck className="w-4 h-4" /> Aplicar Ajuste</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Componente Principal ───────────────────────────────────────────────────────
export const DebtManagementPanel: React.FC<DebtManagementPanelProps> = ({ members, onPaymentSuccess }) => {
  const rates: ExchangeRates = getSavedExchangeRates();
  const [filter, setFilter] = useState<DebtFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [paymentMember, setPaymentMember] = useState<Member | null>(null);
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [reminderMember, setReminderMember] = useState<Member | null>(null);
  const [adjustMember, setAdjustMember] = useState<Member | null>(null);

  // KPI Metrics
  const kpis = useMemo(() => {
    const debtors = members.filter((m) => m.debtAmount > 0);
    const expired = members.filter((m) => getDaysRemaining(m.expirationDate) < 0 && m.debtAmount === 0);
    const expiring = members.filter((m) => {
      const d = getDaysRemaining(m.expirationDate);
      return d >= 0 && d <= 7 && m.debtAmount === 0;
    });
    const totalDebt = debtors.reduce((acc, m) => acc + m.debtAmount, 0);
    const activeOk = members.filter((m) => m.debtAmount === 0 && getDaysRemaining(m.expirationDate) > 7);
    const collectionRate = members.length > 0 ? Math.round((activeOk.length / members.length) * 100) : 0;

    return { debtors, expired, expiring, totalDebt, activeOk, collectionRate };
  }, [members]);

  // Filtrado de socios
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const daysLeft = getDaysRemaining(m.expirationDate);
      const matchesSearch =
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.dni.includes(searchTerm) ||
        m.qrToken.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (filter === 'DEBTOR') return m.debtAmount > 0;
      if (filter === 'EXPIRED') return daysLeft < 0 && m.debtAmount === 0;
      if (filter === 'EXPIRING') return daysLeft >= 0 && daysLeft <= 7 && m.debtAmount === 0;
      if (filter === 'ACTIVE') return m.debtAmount === 0 && daysLeft > 7;
      return true;
    });
  }, [members, filter, searchTerm]);

  // Selección masiva
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  }, [filteredMembers, selectedIds.size]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Exportar reporte de morosidad
  const handleExportDebtReport = useCallback(() => {
    const debtors = filteredMembers.filter((m) => m.debtAmount > 0);
    exportMembersToExcel(debtors);
  }, [filteredMembers]);

  // Recordatorio masivo (abre WhatsApp de cada moroso seleccionado)
  const handleBatchReminder = useCallback(() => {
    const targets = filteredMembers.filter((m) => selectedIds.has(m.id) && m.debtAmount > 0);
    if (targets.length === 0) {
      alert('Seleccione socios morosos para enviar recordatorios masivos.');
      return;
    }
    targets.forEach((m) => {
      const msg = `Hola ${m.name} ${m.lastName} 👋\n*40Golden Gym* - Recordatorio:\n💰 Saldo adeudado: *$${m.debtAmount.toFixed(2)} USD*\n📅 Vencimiento: *${formatDateLatam(m.expirationDate)}*\n\n¡Regularice su membresía para seguir entrenando! 💪`;
      window.open(`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }, [filteredMembers, selectedIds]);

  const filterButtons: { key: DebtFilter; label: string; count: number; color: string }[] = [
    { key: 'ALL', label: 'Todos', count: members.length, color: 'bg-slate-900 text-white border-slate-900' },
    { key: 'DEBTOR', label: '🔴 Morosos', count: kpis.debtors.length, color: 'bg-rose-600 text-white border-rose-500' },
    { key: 'EXPIRED', label: '🟡 Vencidos', count: kpis.expired.length, color: 'bg-amber-600 text-white border-amber-500' },
    { key: 'EXPIRING', label: '🟠 Por Vencer (7d)', count: kpis.expiring.length, color: 'bg-orange-500 text-white border-orange-400' },
    { key: 'ACTIVE', label: '🟢 Al Día', count: kpis.activeOk.length, color: 'bg-emerald-600 text-white border-emerald-500' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-rose-500 uppercase tracking-wider">Cartera Vencida</span>
            <div className="p-1.5 bg-rose-100 rounded-lg"><DollarSign className="w-4 h-4 text-rose-600" /></div>
          </div>
          <p className="text-2xl font-black text-rose-700">${kpis.totalDebt.toFixed(2)}</p>
          <p className="text-xs font-bold text-rose-400 mt-0.5">
            {formatCurrency(kpis.totalDebt, 'VES', rates)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Socios Morosos</span>
            <div className="p-1.5 bg-amber-100 rounded-lg"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
          </div>
          <p className="text-2xl font-black text-amber-700">{kpis.debtors.length}</p>
          <p className="text-xs font-bold text-amber-400 mt-0.5">de {members.length} socios</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-orange-600 uppercase tracking-wider">Próximos a Vencer</span>
            <div className="p-1.5 bg-orange-100 rounded-lg"><Calendar className="w-4 h-4 text-orange-600" /></div>
          </div>
          <p className="text-2xl font-black text-orange-700">{kpis.expiring.length}</p>
          <p className="text-xs font-bold text-orange-400 mt-0.5">en los próximos 7 días</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">Tasa de Recaudación</span>
            <div className="p-1.5 bg-emerald-100 rounded-lg"><Percent className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <p className="text-2xl font-black text-emerald-700">{kpis.collectionRate}%</p>
          <p className="text-xs font-bold text-emerald-400 mt-0.5">{kpis.activeOk.length} socios al día</p>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, apellido, C.I. o QR token..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filterButtons.map((fb) => (
            <button key={fb.key} onClick={() => setFilter(fb.key)}
              className={`px-3 py-2.5 rounded-xl text-xs font-black border-2 transition-all shadow-sm shrink-0 ${filter === fb.key ? fb.color : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {fb.label} ({fb.count})
            </button>
          ))}
        </div>
      </div>

      {/* Acciones Masivas */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button onClick={handleBatchReminder}
          disabled={selectedIds.size === 0}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white border-2 border-blue-500 font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm">
          <Send className="w-3.5 h-3.5 stroke-[2.5]" /> Recordatorio Masivo ({selectedIds.size})
        </button>
        <button onClick={handleExportDebtReport}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300 font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-sm">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Reporte Morosidad
        </button>
        {selectedIds.size > 0 && (
          <button onClick={() => setSelectedIds(new Set())}
            className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-200 font-black text-xs rounded-xl flex items-center gap-2 transition-all">
            <X className="w-3.5 h-3.5" /> Deseleccionar ({selectedIds.size})
          </button>
        )}
        <span className="text-xs font-bold text-slate-400 ml-auto">{filteredMembers.length} socios mostrados</span>
      </div>

      {/* Tabla Principal de Cobranzas */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-4">
                  <input type="checkbox"
                    checked={selectedIds.size === filteredMembers.length && filteredMembers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded w-4 h-4 accent-emerald-600" />
                </th>
                <th className="py-4 px-4">Socio</th>
                <th className="py-4 px-4">Plan / C.I.</th>
                <th className="py-4 px-4">Vencimiento</th>
                <th className="py-4 px-4">Estado Financiero</th>
                <th className="py-4 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-400">No se encontraron socios con este filtro.</p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const daysLeft = getDaysRemaining(member.expirationDate);
                  const isDebtor = member.debtAmount > 0;
                  const isExpired = daysLeft < 0 && !isDebtor;
                  const isExpiring = daysLeft >= 0 && daysLeft <= 7 && !isDebtor;
                  const avatar = getMemberAvatarUrl(member.name, member.lastName, member.avatarUrl);
                  const isSelected = selectedIds.has(member.id);

                  return (
                    <tr key={member.id}
                      className={`transition-colors hover:bg-slate-50 ${isSelected ? 'bg-emerald-50/50' : ''} ${isDebtor ? 'border-l-4 border-rose-400' : isExpired ? 'border-l-4 border-amber-400' : isExpiring ? 'border-l-4 border-orange-300' : ''}`}>
                      <td className="py-4 px-4">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(member.id)}
                          className="rounded w-4 h-4 accent-emerald-600" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img src={avatar} alt="" className="w-11 h-11 rounded-2xl object-cover border-2 border-slate-200 shadow-sm shrink-0" />
                            {isDebtor && (
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm leading-tight">{member.name} {member.lastName}</p>
                            <p className="text-xs text-slate-500 font-medium">{member.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-xs font-black text-slate-700">{member.planName}</p>
                        <p className="text-xs font-mono font-bold text-slate-400">C.I. {member.dni}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-mono font-black text-slate-800">{formatDateLatam(member.expirationDate)}</span>
                        <div className="mt-0.5">
                          {daysLeft < 0 ? (
                            <span className="text-[11px] font-black text-rose-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Vencido hace {Math.abs(daysLeft)}d
                            </span>
                          ) : daysLeft <= 7 ? (
                            <span className="text-[11px] font-black text-orange-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Vence en {daysLeft}d
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600">Vigente ({daysLeft}d)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {isDebtor ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white font-black text-[11px] rounded-lg">
                              <AlertTriangle className="w-3 h-3" /> MOROSO
                            </span>
                            <p className="text-sm font-black text-rose-600 mt-1">${member.debtAmount.toFixed(2)} USD</p>
                            <p className="text-[11px] font-bold text-rose-300">{formatCurrency(member.debtAmount, 'VES', rates)}</p>
                          </div>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 font-black text-[11px] rounded-lg">
                            <Clock className="w-3 h-3" /> VENCIDO
                          </span>
                        ) : isExpiring ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 border border-orange-200 font-black text-[11px] rounded-lg">
                            <TrendingUp className="w-3 h-3" /> POR VENCER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 font-black text-[11px] rounded-lg">
                            <CheckCircle className="w-3 h-3" /> AL DÍA
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Cobrar */}
                          <button onClick={() => setPaymentMember(member)}
                            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95"
                            title="Cobrar / Renovar">
                            <DollarSign className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          {/* Recordatorio */}
                          <button onClick={() => setReminderMember(member)}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95"
                            title="Enviar Recordatorio">
                            <Send className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          {/* Historial */}
                          <button onClick={() => setHistoryMember(member)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95"
                            title="Historial de Cobros">
                            <History className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          {/* Ajuste de Deuda */}
                          {isDebtor && (
                            <button onClick={() => setAdjustMember(member)}
                              className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95"
                              title="Ajuste de Deuda">
                              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {paymentMember && (
        <QuickPaymentModal
          member={paymentMember}
          onClose={() => setPaymentMember(null)}
          onPaymentSuccess={async (...args) => {
            await onPaymentSuccess(...args);
            setPaymentMember(null);
          }}
        />
      )}
      {historyMember && (
        <PaymentHistoryDrawer member={historyMember} onClose={() => setHistoryMember(null)} />
      )}
      {reminderMember && (
        <SendReminderModal member={reminderMember} onClose={() => setReminderMember(null)} />
      )}
      {adjustMember && (
        <DebtAdjustModal
          member={adjustMember}
          onClose={() => setAdjustMember(null)}
          onAdjusted={(memberId, newDebt) => {
            // El estado se actualizará vía realtime subscription de Supabase
            setAdjustMember(null);
          }}
        />
      )}
    </div>
  );
};
