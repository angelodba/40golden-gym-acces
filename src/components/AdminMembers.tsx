import React, { useState } from 'react';
import { Member } from '../types';
import { generateSecureQrToken } from '../utils/crypto';
import { exportMembersToExcel } from '../utils/excelUtils';
import { ExcelImportModal } from './ExcelImportModal';
import { Users, UserPlus, Search, DollarSign, QrCode, AlertTriangle, CheckCircle, ShieldCheck, KeyRound, FileSpreadsheet, Download } from 'lucide-react';
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DEBTOR' | 'EXPIRED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [viewQrMember, setViewQrMember] = useState<Member | null>(null);

  // New Member Form State
  const [newName, setNewName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('Musculación Standard');
  const [initialDebt, setInitialDebt] = useState('0');

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.dni.includes(searchTerm);
    if (filterStatus === 'ALL') return matchesSearch;
    if (filterStatus === 'DEBTOR') return matchesSearch && m.debtAmount > 0;
    if (filterStatus === 'ACTIVE') return matchesSearch && m.debtAmount === 0 && m.status === 'ACTIVE';
    if (filterStatus === 'EXPIRED') return matchesSearch && m.status === 'EXPIRED';
    return matchesSearch;
  });

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLastName.trim() || !newDni.trim()) return;

    const debt = Math.max(0, parseFloat(initialDebt) || 0);
    const memberId = crypto.randomUUID();
    // Generar Token QR Cifrado Criptográficamente con AES-GCM (Sin PII legible)
    const token = await generateSecureQrToken(memberId);

    const newMember: Member = {
      id: memberId,
      qrToken: token,
      name: newName.trim(),
      lastName: newLastName.trim(),
      dni: newDni.trim(),
      phone: newPhone.trim() || '+54 9 11 0000-0000',
      email: newEmail.trim() || `${newName.toLowerCase().replace(/\s/g, '')}@email.com`,
      status: debt > 0 ? 'DEBTOR' : 'ACTIVE',
      debtAmount: debt,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?auto=format&fit=crop&q=80&w=200`,
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

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" /> Administración de Socios y Cuentas
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gestiona los pases QR firmados criptográficamente, información de clientes y saldos pendientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={() => exportMembersToExcel(members)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
            title="Exportar base de datos de socios a Excel"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Exportar Excel
          </button>

          <button
            onClick={() => setShowExcelModal(true)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
          >
            <FileSpreadsheet className="w-4 h-4" /> Cargar Excel / CSV
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg shadow-emerald-600/20 w-full sm:w-auto justify-center"
          >
            <UserPlus className="w-4 h-4" /> Registrar Nuevo Socio
          </button>
        </div>
      </div>


      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar socio por Nombre, Apellido o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="md:col-span-4 flex items-center gap-2">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filterStatus === 'ALL'
                ? 'bg-slate-800 text-slate-100 border-slate-700'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Todos ({members.length})
          </button>
          <button
            onClick={() => setFilterStatus('DEBTOR')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filterStatus === 'DEBTOR'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Morosos ({members.filter((m) => m.debtAmount > 0).length})
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                <th className="py-3.5 px-4">Socio</th>
                <th className="py-3.5 px-4">DNI / Documento</th>
                <th className="py-3.5 px-4">Plan Actual</th>
                <th className="py-3.5 px-4">Estado de Deuda</th>
                <th className="py-3.5 px-4">Código QR Seguro</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredMembers.map((member) => {
                const isDebtor = member.debtAmount > 0;
                return (
                  <tr key={member.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-bold text-slate-100">{member.name} {member.lastName}</p>
                          <p className="text-[11px] text-slate-400">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">{member.dni}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-300 font-medium">{member.planName}</span>
                      <p className="text-[10px] text-slate-500">Vence: {member.expirationDate}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {isDebtor ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Debe ${member.debtAmount.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Al Día ($0.00)</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setViewQrMember(member)}
                        className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ver QR Seguro</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isDebtor ? (
                        <button
                          onClick={() => onOpenPaymentModal(member)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 shadow-md transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Cobrar Deuda
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Sin pendiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No se encontraron socios con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" /> Registrar Nuevo Socio
            </h3>
            <form onSubmit={handleCreateMember} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Apellido *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">DNI / Documento *</label>
                <input
                  type="text"
                  required
                  value={newDni}
                  onChange={(e) => setNewDni(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Plan Inicial</label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Musculación Standard">Musculación Standard</option>
                    <option value="Pase Total VIP (Mensual)">Pase Total VIP (Mensual)</option>
                    <option value="Crossfit & Funcional">Crossfit & Funcional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Saldo o Deuda Inicial ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialDebt}
                  onChange={(e) => setInitialDebt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Generar QR Firmado & Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Viewer & Export Modal */}
      {viewQrMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Pase QR Firmado: {viewQrMember.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Protegido con Criptografía HMAC-SHA256</p>
            </div>

            {/* Renderable Canvas for PNG Export */}
            <div id="qr-export-card" className="p-5 bg-white rounded-2xl inline-block shadow-xl border-4 border-slate-800">
              <QRCodeCanvas
                id="qr-canvas-element"
                value={viewQrMember.qrToken}
                size={180}
                level="H"
                includeMargin={true}
              />
              <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mt-1">FITPASS GIMNASIO</p>
              <p className="text-xs font-bold text-slate-900">{viewQrMember.name} {viewQrMember.lastName}</p>
              <p className="text-[9px] font-mono text-slate-500">DNI: {viewQrMember.dni}</p>
            </div>

            <p className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 break-all">
              {viewQrMember.qrToken}
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  const canvas = document.getElementById('qr-canvas-element') as HTMLCanvasElement;
                  if (canvas) {
                    const pngUrl = canvas.toDataURL('image/png');
                    const downloadLink = document.createElement('a');
                    downloadLink.href = pngUrl;
                    downloadLink.download = `Pase-QR-Seguro-${viewQrMember.name}-${viewQrMember.lastName}.png`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                  }
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                📥 Descargar Imagen QR (PNG)
              </button>

              <button
                onClick={() => {
                  const msg = encodeURIComponent(
                    `Hola ${viewQrMember.name}! Aquí tienes tu Pase QR Seguro de acceso al Gimnasio FITPASS. Presenta este código QR en tu teléfono cada vez que ingreses.`
                  );
                  const phoneNum = viewQrMember.phone.replace(/[^0-9]/g, '');
                  window.open(`https://wa.me/${phoneNum}?text=${msg}`, '_blank');
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                💬 Enviar Aviso por WhatsApp
              </button>

              <button
                onClick={() => setViewQrMember(null)}
                className="w-full text-slate-400 hover:text-slate-200 py-1.5 text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Excel Import Modal */}
      {showExcelModal && (
        <ExcelImportModal
          existingMembers={members}
          onClose={() => setShowExcelModal(false)}
          onImportSuccess={async (newMembersBatch) => {
            if (onAddMembersBatch) {
              await onAddMembersBatch(newMembersBatch);
            } else {
              newMembersBatch.forEach((m) => onAddMember(m));
            }
          }}
        />
      )}
    </div>
  );
};

