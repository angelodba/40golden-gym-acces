import React, { useState } from 'react';
import { Member, ExchangeRates, Currency } from '../types';
import { generateSecureQrToken } from '../utils/crypto';
import { exportMembersToExcel } from '../utils/excelUtils';
import { getMemberAvatarUrl } from '../utils/avatarUtils';
import { getSavedExchangeRates, saveExchangeRates, formatCurrency, getDaysRemaining } from '../utils/currencyUtils';
import { ExcelImportModal } from './ExcelImportModal';
import { Users, UserPlus, Search, DollarSign, QrCode, AlertTriangle, CheckCircle, ShieldCheck, FileSpreadsheet, Download, Calendar, Coins, ArrowRightLeft, Clock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface AdminMembersProps {
  members: Member[];
  onAddMember: (newMember: Member) => void;
  onAddMembersBatch?: (newMembers: Member[]) => Promise<Member[] | void>;
  onOpenPaymentModal: (member: Member) => void;
}

export const AdminMembers: React.FC<AdminMembersProps> = ({
  members,
  onAddMember,
  onAddMembersBatch,
  onOpenPaymentModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DEBTOR' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [viewQrMember, setViewQrMember] = useState<Member | null>(null);

  // Configuración de Tasas de Cambio Multi-Moneda (USD / VES / COP)
  const [rates, setRates] = useState<ExchangeRates>(getSavedExchangeRates());
  const [showRateConfig, setShowRateConfig] = useState(false);
  const [editVesRate, setEditVesRate] = useState(rates.VES.toString());
  const [editCopRate, setEditCopRate] = useState(rates.COP.toString());

  // Formulario Nuevo Socio
  const [newName, setNewName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('Musculación Standard');
  const [initialDebt, setInitialDebt] = useState('0');

  const handleSaveRates = () => {
    const ves = parseFloat(editVesRate) || rates.VES;
    const cop = parseFloat(editCopRate) || rates.COP;
    const newRates = { VES: ves, COP: cop };
    setRates(newRates);
    saveExchangeRates(newRates);
    setShowRateConfig(false);
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.dni.includes(searchTerm);

    const daysRemaining = getDaysRemaining(m.expirationDate);

    if (filterStatus === 'ALL') return matchesSearch;
    if (filterStatus === 'DEBTOR') return matchesSearch && m.debtAmount > 0;
    if (filterStatus === 'ACTIVE') return matchesSearch && m.debtAmount === 0 && daysRemaining > 5;
    if (filterStatus === 'EXPIRING_SOON') return matchesSearch && daysRemaining >= 0 && daysRemaining <= 5;
    if (filterStatus === 'EXPIRED') return matchesSearch && (m.status === 'EXPIRED' || daysRemaining < 0);
    return matchesSearch;
  });

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLastName.trim() || !newDni.trim()) return;

    const debt = Math.max(0, parseFloat(initialDebt) || 0);
    const memberId = crypto.randomUUID();
    const token = await generateSecureQrToken(memberId);

    const name = newName.trim();
    const lastName = newLastName.trim();

    const newMember: Member = {
      id: memberId,
      qrToken: token,
      name,
      lastName,
      dni: newDni.trim(),
      phone: newPhone.trim() || '+58 414 000-0000',
      email: newEmail.trim() || `${name.toLowerCase().replace(/\s/g, '')}@email.com`,
      status: debt > 0 ? 'DEBTOR' : 'ACTIVE',
      debtAmount: debt,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      avatarUrl: getMemberAvatarUrl(name, lastName),
      planName: newPlan,
    };

    onAddMember(newMember);
    setShowAddModal(false);
    setNewName('');
    setNewLastName('');
    setNewDni('');
    setNewPhone('');
    setNewEmail('');
    setInitialDebt('0');
  };

  // Totales financieros de cartera
  const totalDebtUSD = members.reduce((acc, m) => acc + m.debtAmount, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Control General */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-600 text-white rounded-2xl border-2 border-emerald-500 shadow-lg shadow-emerald-600/30 shrink-0">
            <Users className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Gestión de Socios y Cobros Multi-Moneda
            </h2>
            <p className="text-sm font-bold text-slate-600 mt-1">
              Control de membresías, vencimientos en calendario y recaudación en USD, Bs. y COP.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowRateConfig(!showRateConfig)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-300 font-black px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm"
          >
            <Coins className="w-4 h-4 stroke-[2.5]" /> Tasas de Cambio
          </button>

          <button
            onClick={() => exportMembersToExcel(members)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-900 border-2 border-slate-300 font-extrabold px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 stroke-[2.5]" /> Exportar Excel
          </button>

          {onAddMembersBatch && (
            <button
              onClick={() => setShowExcelModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-500 font-black px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" /> Importar Excel
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-500 font-black px-5 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" /> Registrar Socio
          </button>
        </div>
      </div>

      {/* Panel Ajuste de Tasas Multi-Moneda */}
      {showRateConfig && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 shadow-lg space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-emerald-950 flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
              Configurar Tasas de Cambio del Sistema
            </h3>
            <span className="text-xs font-bold text-emerald-800">Actualizado para cobros en Venezuela & Colombia</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-emerald-900 mb-1">
                🇻🇪 Tasa Bolívares (Bs. por 1 USD):
              </label>
              <input
                type="number"
                step="0.1"
                value={editVesRate}
                onChange={(e) => setEditVesRate(e.target.value)}
                className="w-full bg-white border-2 border-emerald-300 rounded-xl px-3.5 py-2 text-sm font-black text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-emerald-900 mb-1">
                🇨🇴 Tasa Pesos Colombianos (COP por 1 USD):
              </label>
              <input
                type="number"
                step="10"
                value={editCopRate}
                onChange={(e) => setEditCopRate(e.target.value)}
                className="w-full bg-white border-2 border-emerald-300 rounded-xl px-3.5 py-2 text-sm font-black text-slate-900 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveRates}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-xl text-xs shadow"
            >
              Guardar Tasas
            </button>
          </div>
        </div>
      )}

      {/* Resumen de Cartera y Totales en Monedas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cartera Ocupada</span>
            <span className="text-2xl font-black text-slate-900">{members.length} Socios</span>
          </div>
          <Users className="w-8 h-8 text-emerald-600 stroke-[2.5]" />
        </div>
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Deuda Total Pendiente</span>
            <span className="text-2xl font-black text-rose-600">${totalDebtUSD.toFixed(2)} USD</span>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-600 stroke-[2.5]" />
        </div>
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">Equivalente Multi-Moneda</span>
          <p className="text-xs font-mono font-black text-slate-900">
            🇻🇪 {formatCurrency(totalDebtUSD, 'VES', rates)}
          </p>
          <p className="text-xs font-mono font-black text-slate-900 mt-0.5">
            🇨🇴 {formatCurrency(totalDebtUSD, 'COP', rates)}
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros de Calendario */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6 relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 stroke-[2.5]" />
          <input
            type="text"
            placeholder="Buscar por Nombre, Apellido o Cédula (C.I)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-900 placeholder-slate-500 focus:outline-none shadow-sm"
          />
        </div>

        <div className="md:col-span-6 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black border-2 transition-all shadow-sm shrink-0 ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Todos ({members.length})
          </button>
          <button
            onClick={() => setFilterStatus('DEBTOR')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black border-2 transition-all shadow-sm shrink-0 ${
              filterStatus === 'DEBTOR'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-600 border-rose-300 hover:bg-rose-50'
            }`}
          >
            Morosos ({members.filter((m) => m.debtAmount > 0).length})
          </button>
          <button
            onClick={() => setFilterStatus('EXPIRING_SOON')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black border-2 transition-all shadow-sm shrink-0 ${
              filterStatus === 'EXPIRING_SOON'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
            }`}
          >
            ⚡ Próximos (≤5d)
          </button>
          <button
            onClick={() => setFilterStatus('EXPIRED')}
            className={`px-3 py-2.5 rounded-xl text-xs font-black border-2 transition-all shadow-sm shrink-0 ${
              filterStatus === 'EXPIRED'
                ? 'bg-rose-950 text-white border-rose-900'
                : 'bg-white text-rose-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            🚫 Vencidos
          </button>
        </div>
      </div>

      {/* Tabla de Socios Claro */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs font-black text-slate-900 uppercase tracking-wider bg-slate-100">
                <th className="py-4 px-5">Socio</th>
                <th className="py-4 px-5">Cédula (C.I.)</th>
                <th className="py-4 px-5">Plan</th>
                <th className="py-4 px-5">Vencimiento Calendario</th>
                <th className="py-4 px-5">Estado Financiero</th>
                <th className="py-4 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 text-sm font-bold text-slate-800">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 font-bold">
                    No se encontraron socios registrados con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isDebtor = member.debtAmount > 0;
                  const daysRemaining = getDaysRemaining(member.expirationDate);
                  const avatar = getMemberAvatarUrl(member.name, member.lastName, member.avatarUrl);

                  return (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt=""
                            className="w-11 h-11 rounded-2xl object-cover border-2 border-slate-300 shadow-sm shrink-0"
                          />
                          <div>
                            <p className="font-black text-slate-900 leading-tight">
                              {member.name} {member.lastName}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">{member.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-900 font-black">{member.dni}</td>
                      <td className="py-4 px-5">{member.planName}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-slate-900">{member.expirationDate}</span>
                          {daysRemaining < 0 ? (
                            <span className="text-[11px] font-black text-rose-600 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 stroke-[3]" /> Vencido hace {Math.abs(daysRemaining)} d
                            </span>
                          ) : daysRemaining <= 5 ? (
                            <span className="text-[11px] font-black text-amber-600 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 stroke-[3]" /> Vence en {daysRemaining} días
                            </span>
                          ) : (
                            <span className="text-[11px] font-extrabold text-emerald-600 mt-0.5">
                              Vigente ({daysRemaining} días)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        {isDebtor ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs shadow w-fit">
                              <AlertTriangle className="w-3.5 h-3.5 stroke-[3]" /> MOROSO
                            </span>
                            <span className="text-rose-600 font-black text-sm mt-1">
                              ${member.debtAmount.toFixed(2)} USD
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs shadow">
                            <CheckCircle className="w-3.5 h-3.5 stroke-[3]" /> AL DÍA ($0.00)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewQrMember(member)}
                            className="p-2.5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-900 rounded-xl transition-all shadow-sm"
                            title="Ver pase QR"
                          >
                            <QrCode className="w-4.5 h-4.5 stroke-[2.5]" />
                          </button>
                          <button
                            onClick={() => onOpenPaymentModal(member)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-500 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
                          >
                            <DollarSign className="w-4 h-4 stroke-[3]" /> Cobrar / Renovar
                          </button>
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

      {/* Modal Registrar Nuevo Socio */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-300 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-4">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-emerald-600 stroke-[2.5]" />
                Registrar Nuevo Socio
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-black text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-900 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej. Carlos"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-900 mb-1">Apellido *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Ej. Silva"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 mb-1">Cédula (C.I.) *</label>
                <input
                  type="text"
                  required
                  value={newDni}
                  onChange={(e) => setNewDni(e.target.value)}
                  placeholder="Ej. 18492048"
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-900 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+58 414 000-0000"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-900 mb-1">Plan</label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Musculación Standard">Musculación Standard</option>
                    <option value="Pase Total VIP (Mensual)">Pase Total VIP (Mensual)</option>
                    <option value="Crossfit & Funcional">Crossfit & Funcional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 mb-1">Deuda Inicial ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialDebt}
                  onChange={(e) => setInitialDebt(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-100 border-2 border-slate-300 text-slate-800 font-black py-3 rounded-2xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 text-white font-black py-3 rounded-2xl text-sm shadow-xl border-2 border-emerald-500"
                >
                  Guardar Socio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pase QR */}
      {viewQrMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-300 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <h3 className="text-xl font-black text-slate-900">Pase QR Criptográfico</h3>
              <button
                onClick={() => setViewQrMember(null)}
                className="text-slate-400 hover:text-slate-700 font-black text-xl"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200 inline-block shadow-inner">
              <QRCodeCanvas value={viewQrMember.qrToken} size={200} level="H" />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                {viewQrMember.name} {viewQrMember.lastName}
              </h4>
              <p className="text-sm font-bold text-slate-600 font-mono mt-0.5">C.I.: {viewQrMember.dni}</p>
            </div>

            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-3 text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              Cifrado AES-GCM Sin Datos Personales
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar Excel */}
      {showExcelModal && onAddMembersBatch && (
        <ExcelImportModal
          existingMembers={members}
          onClose={() => setShowExcelModal(false)}
          onImportSuccess={async (batch: Member[]) => {
            await onAddMembersBatch(batch);
            setShowExcelModal(false);
          }}
        />
      )}
    </div>
  );
};
