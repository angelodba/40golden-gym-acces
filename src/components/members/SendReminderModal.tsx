import React, { useState } from 'react';
import { Member } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { X, Send, MessageCircle, Mail, ShieldCheck, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface SendReminderModalProps {
  member: Member;
  onClose: () => void;
}

type Channel = 'whatsapp' | 'email';

export const SendReminderModal: React.FC<SendReminderModalProps> = ({ member, onClose }) => {
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [customNote, setCustomNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [auditLogged, setAuditLogged] = useState(false);

  const defaultMessage = `Hola ${member.name} ${member.lastName} 👋

Le saludamos del equipo de *40Golden Gym*.

🔔 *Recordatorio de Cobro:*
• Saldo adeudado: *$${member.debtAmount.toFixed(2)} USD*
• Fecha de vencimiento: *${member.expirationDate}*
• Plan activo: ${member.planName}

${customNote ? `📝 Nota adicional:\n${customNote}\n` : ''}Para regularizar su membresía, acérquese a recepción o contacte a su entrenador.

¡Le esperamos para seguir entrenando! 💪🏋️

_Equipo 40Golden Gym_`;

  const emailBody = `Estimado/a ${member.name} ${member.lastName},

Nos ponemos en contacto desde 40Golden Gym para informarle sobre el estado de su membresía.

Estado de Cuenta:
- Saldo Adeudado: $${member.debtAmount.toFixed(2)} USD
- Fecha de Vencimiento: ${member.expirationDate}
- Plan: ${member.planName}
- Cédula: ${member.dni}
${customNote ? `\nNota: ${customNote}\n` : ''}
Para regularizar su cuenta, puede acercarse a nuestras instalaciones en horario de atención o comunicarse con nosotros.

Recuerde que con su membresía al día podrá seguir disfrutando de todos nuestros servicios.

¡Contamos con su pronto arreglo!

Atentamente,
Equipo de Administración
40Golden Gym`;

  const whatsappLink = `https://wa.me/${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(defaultMessage)}`;
  const mailtoLink = `mailto:${member.email}?subject=Recordatorio de Cobro - 40Golden Gym&body=${encodeURIComponent(emailBody)}`;

  const logAudit = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      await supabase.from('auditoria_sistema').insert([{
        tabla_afectada: 'socios',
        operacion: 'RECORDATORIO_ENVIADO',
        socio_id: member.id,
        detalles: {
          canal: channel,
          monto_adeudado: member.debtAmount,
          mensaje_personalizado: customNote || null,
        },
        realizado_por: 'RECEPCION',
      }]);
      setAuditLogged(true);
    } catch {
      // No bloquear si la auditoría falla
    }
  };

  const handleSend = async () => {
    setSending(true);
    await logAudit();

    if (channel === 'whatsapp') {
      window.open(whatsappLink, '_blank');
    } else {
      window.open(mailtoLink, '_blank');
    }

    setSending(false);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border-2 border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <Send className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Recordatorio de Cobro</h3>
              <p className="text-xs font-bold text-blue-100">{member.name} {member.lastName} · ${member.debtAmount.toFixed(2)} USD adeudado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {sent ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">¡Recordatorio Enviado!</h4>
                <p className="text-sm font-bold text-slate-500 mt-1">
                  El recordatorio fue generado y el registro de auditoría creado.
                </p>
                {auditLogged && (
                  <p className="text-xs font-bold text-indigo-600 mt-2 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Registrado en auditoría del sistema
                  </p>
                )}
              </div>
              <button onClick={onClose}
                className="w-full bg-emerald-600 text-white font-black py-3 rounded-2xl text-sm shadow border-2 border-emerald-500">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {/* Alerta de deuda */}
              {member.debtAmount > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-800">
                    Saldo moroso: <strong>${member.debtAmount.toFixed(2)} USD</strong> · Vencimiento: {member.expirationDate}
                  </p>
                </div>
              )}

              {/* Canal */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Canal de Envío:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setChannel('whatsapp')}
                    className={`py-3 rounded-xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 ${channel === 'whatsapp' ? 'bg-green-500 text-white border-green-400 shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button onClick={() => setChannel('email')}
                    className={`py-3 rounded-xl text-sm font-black border-2 transition-all flex items-center justify-center gap-2 ${channel === 'email' ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <Mail className="w-4 h-4" /> Email
                  </button>
                </div>
              </div>

              {/* Info de contacto */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  {channel === 'whatsapp' ? '📱 Tel:' : '📧 Email:'}
                </span>
                <span className="text-xs font-black text-slate-900 font-mono">
                  {channel === 'whatsapp' ? member.phone : member.email}
                </span>
              </div>

              {/* Mensaje Preview */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Vista Previa del Mensaje:</label>
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 max-h-44 overflow-y-auto">
                  <pre className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                    {channel === 'whatsapp' ? defaultMessage : emailBody}
                  </pre>
                </div>
              </div>

              {/* Nota adicional */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">Nota Adicional (Opcional):</label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={2}
                  placeholder="Ej: Puede pagar en efectivo o por transferencia..."
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none resize-none"
                />
              </div>

              {/* Acciones */}
              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 bg-slate-100 border-2 border-slate-300 text-slate-800 font-black py-3 rounded-2xl text-sm hover:bg-slate-200 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSend} disabled={sending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-sm shadow-lg border-2 border-blue-500 flex items-center justify-center gap-2 transition-all">
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Abriendo...</>
                  ) : (
                    <><Send className="w-4 h-4 stroke-[2.5]" /> Enviar Recordatorio</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
