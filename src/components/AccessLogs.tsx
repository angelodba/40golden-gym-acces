import React, { useState } from 'react';
import { AccessLog } from '../types';
import { History, CheckCircle2, XCircle, Trash2, Calendar, ShieldCheck } from 'lucide-react';
import { getMemberAvatarUrl } from '../utils/avatarUtils';

interface AccessLogsProps {
  logs: AccessLog[];
  onClearLogs?: () => Promise<void>;
}

export const AccessLogs: React.FC<AccessLogsProps> = ({ logs, onClearLogs }) => {
  const [clearing, setClearing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredLogs = logs.filter((log) => {
    if (!startDate && !endDate) return true;
    // log.timestamp viene formateado como fecha local (o string ISO)
    const logDate = new Date(log.timestamp);
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      if (logDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      if (logDate > end) return false;
    }
    return true;
  });

  const handleClearHistory = async () => {
    if (!onClearLogs) return;
    const confirmClear = window.confirm(
      '¿Estás seguro de que deseas purgar todo el historial de accesos? Esta acción eliminará los registros de Supabase y memoria local.'
    );
    if (!confirmClear) return;

    setClearing(true);
    try {
      await onClearLogs();
    } catch (err) {
      console.error('Error al purgar historial:', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Historial Claro de Alta Visibilidad */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-600 text-white rounded-2xl border-2 border-emerald-500 shadow-lg shadow-emerald-600/30 shrink-0">
            <History className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Auditoría y Registro de Accesos
            </h2>
            <p className="text-sm font-bold text-slate-600 mt-1">
              Historial completo diario y anual de entradas concedidas y denegadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-300 shadow-sm">
            Total Registros: {filteredLogs.length}
          </span>
          {onClearLogs && (
            <button
              onClick={handleClearHistory}
              disabled={clearing || logs.length === 0}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all border-2 border-rose-500 shrink-0"
            >
              <Trash2 className="w-4 h-4 stroke-[2.5]" />
              {clearing ? 'Purgando...' : 'Purga Manual'}
            </button>
          )}
        </div>
      </div>

      {/* Filtros de Rango de Fechas */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-black text-slate-700">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Filtrar por Rango de Fechas:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 underline"
            >
              Limpiar Fechas
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Registros Claro de Alto Contraste */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs font-black text-slate-900 uppercase tracking-wider bg-slate-100">
                <th className="py-4 px-5">Fecha / Hora</th>
                <th className="py-4 px-5">Socio</th>
                <th className="py-4 px-5">Resultado Acceso</th>
                <th className="py-4 px-5">Detalle / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 text-sm font-bold text-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-500 font-bold">
                    <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    No hay registros de acceso acumulados para este rango de fechas.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isGranted = log.status === 'GRANTED';
                  const avatar = getMemberAvatarUrl(log.memberName, '', log.avatarUrl);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-5 font-mono text-slate-900 font-extrabold whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover border-2 border-slate-300 shadow-sm shrink-0"
                          />
                          <span className="font-black text-slate-900">{log.memberName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs shadow">
                            <CheckCircle2 className="w-4 h-4 stroke-[3]" /> CONCEDIDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs shadow">
                            <XCircle className="w-4 h-4 stroke-[3]" /> DENEGADO
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-slate-800 font-bold">
                        {log.reason}
                        {log.debtAmount && log.debtAmount > 0 ? (
                          <span className="block text-xs font-black text-rose-600 mt-0.5">
                            Saldo adeudado: ${log.debtAmount.toFixed(2)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
