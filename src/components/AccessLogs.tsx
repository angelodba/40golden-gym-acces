import React from 'react';
import { AccessLog } from '../types';
import { History, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface AccessLogsProps {
  logs: AccessLog[];
}

export const AccessLogs: React.FC<AccessLogsProps> = ({ logs }) => {
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" /> Registro Histórico de Accesos en Tiempo Real
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Histórico de escaneos realizados en recepción y torniquetes con estado y justificación.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          Total de registros: {logs.length}
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                <th className="py-3.5 px-4">Fecha / Hora</th>
                <th className="py-3.5 px-4">Socio</th>
                <th className="py-3.5 px-4">Resultado Acceso</th>
                <th className="py-3.5 px-4">Detalle / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {logs.map((log) => {
                const isGranted = log.status === 'GRANTED';
                return (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        {log.avatarUrl ? (
                          <img src={log.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                            ?
                          </div>
                        )}
                        <span className="font-bold text-slate-200">{log.memberName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {isGranted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CONCEDIDO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> DENEGADO
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {log.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
