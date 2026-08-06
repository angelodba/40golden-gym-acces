import React, { useState, useEffect, useRef } from 'react';
import { Member, AccessLog } from '../types';
import { verifyAccess } from '../services/supabaseService';
import { subscribeToScanEvents, broadcastScanEvent } from '../utils/broadcast';
import { playAccessSound, primeAudioContext } from '../utils/audio';
import {
  Monitor, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  Lock, Unlock, DollarSign, History, Sparkles, Clock, User, Zap, Search
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReceptionDisplayDashboardProps {
  members: Member[];
  logs?: AccessLog[];
  onLogAccess: (log: AccessLog) => void;
  onOpenPaymentModal: (member: Member) => void;
}

export const ReceptionDisplayDashboard: React.FC<ReceptionDisplayDashboardProps> = ({
  members,
  logs = [],
  onLogAccess,
  onOpenPaymentModal,
}) => {
  const [lastResult, setLastResult] = useState<{
    member?: Member;
    status: 'GRANTED' | 'DENIED';
    reason: string;
    timestamp: string;
  } | null>(null);

  const [recentPasses, setRecentPasses] = useState<AccessLog[]>(logs.slice(0, 15));
  const [directInput, setDirectInput] = useState<string>('');
  const membersRef = useRef<Member[]>(members);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Si hay registros previos en logs y aún no se ha recibido un escaneo en vivo, cargar el último registro como vista inicial
  useEffect(() => {
    if (logs.length > 0) {
      setRecentPasses(logs.slice(0, 15));
      if (!lastResult && logs[0]) {
        const latestLog = logs[0];
        const matchedMember = members.find((m) => m.id === latestLog.memberId || `${m.name} ${m.lastName}` === latestLog.memberName);
        setLastResult({
          member: matchedMember,
          status: latestLog.status,
          reason: latestLog.reason,
          timestamp: new Date(latestLog.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    }
  }, [logs]);

  // Inicializar contexto Web Audio API con la primera interacción del usuario
  useEffect(() => {
    const handleFirstClick = () => {
      primeAudioContext();
      window.removeEventListener('click', handleFirstClick);
    };
    window.addEventListener('click', handleFirstClick);
    return () => window.removeEventListener('click', handleFirstClick);
  }, []);

  // Función centralizada para procesar y desplegar la verificación de un token
  const processTokenVerification = async (token: string) => {
    const cleanToken = token.trim();
    if (!cleanToken) return;

    console.log('[ReceptionDisplay] Procesando verificación:', cleanToken);

    // 1. Verificar acceso con Supabase / Memoria Local
    const result = await verifyAccess(cleanToken, membersRef.current);
    setLastResult(result);

    // 2. Efectos visuales y sonoros
    if (result.status === 'GRANTED') {
      playAccessSound(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#10b981', '#34d399', '#f8fafc', '#fbbf24'],
        zIndex: 1000,
      });
    } else {
      playAccessSound(false);
    }

    // 3. Crear nuevo registro de acceso
    const newLog: AccessLog = {
      id: crypto.randomUUID(),
      memberId: result.member?.id || 'UNKNOWN',
      memberName: result.member ? `${result.member.name} ${result.member.lastName}` : 'Desconocido / Inválido',
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: result.status,
      reason: result.reason,
      debtAmount: result.member?.debtAmount,
      avatarUrl: result.member?.avatarUrl,
    };

    // 4. Prepend al historial en vivo
    setRecentPasses((prev) => [newLog, ...prev.filter((p) => p.id !== newLog.id)].slice(0, 15));

    // 5. Guardar en estado global / Supabase
    onLogAccess(newLog);

    // 6. Transmitir por Broadcast a otros dispositivos sincronizados
    await broadcastScanEvent({ token: cleanToken, timestamp: Date.now() });
  };

  useEffect(() => {
    // Suscribirse a eventos transmitidos en vivo desde la Terminal Escáner Móvil
    const unsubscribe = subscribeToScanEvents(async ({ token }) => {
      console.log('[ReceptionDisplay] Evento escaneado recibido por Broadcast:', token);
      await processTokenVerification(token);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDirectScanSubmit = () => {
    if (!directInput.trim()) return;
    processTokenVerification(directInput.trim());
    setDirectInput('');
  };

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-6rem)] p-4 sm:p-6 space-y-6">
      {/* Header Recepción Claro de Alta Visibilidad para Luz del Día */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-600 text-white rounded-2xl border-2 border-emerald-500 shadow-lg shadow-emerald-600/30 shrink-0">
              <Monitor className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                Pantalla de Recepción
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  EN TIEMPO REAL
                </span>
              </h1>
              <p className="text-sm font-bold text-slate-700 mt-1">
                Diseño de Alta Visibilidad e Impecable Contraste para Luz de Día.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-900 bg-slate-100 px-4 py-2.5 rounded-xl border-2 border-slate-300 self-stretch md:self-auto justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Sincronizado con Escáner Móvil</span>
          </div>
        </div>

        {/* Bar de Validación Rápida en Recepción */}
        <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 stroke-[2.5]" />
            <input
              type="text"
              value={directInput}
              onChange={(e) => setDirectInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDirectScanSubmit()}
              placeholder="Validar por Cédula (C.I.) o Token (Ej. 18492048)..."
              className="w-full bg-slate-50 border-2 border-slate-300 focus:border-emerald-600 rounded-2xl pl-12 pr-4 py-3.5 text-sm sm:text-base font-bold text-slate-900 placeholder-slate-500 focus:outline-none font-mono shadow-inner"
            />
          </div>
          <button
            onClick={handleDirectScanSubmit}
            disabled={!directInput.trim()}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black px-6 py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-xl hover:scale-[1.02] active:scale-95 shrink-0"
          >
            <Zap className="w-4 h-4 fill-current" /> Validar Entrada
          </button>

          {/* Botones de Prueba Rápida en Modo Claro */}
          <div className="flex items-center gap-2 shrink-0 overflow-x-auto w-full sm:w-auto pt-2 sm:pt-0">
            <button
              onClick={() => processTokenVerification('18492048')}
              className="bg-emerald-600 text-white border-2 border-emerald-500 hover:bg-emerald-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black shrink-0 transition-all shadow-md"
            >
              ⚡ Carlos (Al día)
            </button>
            <button
              onClick={() => processTokenVerification('29481029')}
              className="bg-rose-600 text-white border-2 border-rose-500 hover:bg-rose-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black shrink-0 transition-all shadow-md"
            >
              ⚡ Valentina (Morosa)
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal: Pantalla de Verificación Destacada + Historial de Pases en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL PRINCIPAL (7 cols): Tarjeta de Verificación Principal de Fondo Claro */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl flex-1 flex flex-col justify-center min-h-[520px]">
            {!lastResult ? (
              <div className="text-center py-16">
                <div className="relative inline-flex mb-6">
                  <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-3xl animate-pulse"></div>
                  <Monitor className="w-28 h-28 text-slate-400 relative z-10 mx-auto stroke-[1.5]" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sistema en Espera</h2>
                <p className="text-slate-600 font-bold mt-2 max-w-md mx-auto text-base">
                  Usa el campo de verificación rápida arriba, las pruebas de 1-clic o el escáner del personal.
                </p>
                <div className="mt-8 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-100 border-2 border-slate-300 text-xs sm:text-sm font-mono font-extrabold text-slate-700 shadow-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" /> Escaneando señal de acceso en vivo...
                </div>
              </div>
            ) : (
              <div className="w-full">
                {lastResult.status === 'GRANTED' && lastResult.member && (
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-4 border-emerald-400 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 text-slate-950">
                    <div className="flex items-center justify-between mb-6">
                      <span className="inline-flex items-center gap-2 text-sm sm:text-base font-black bg-slate-950 text-emerald-400 px-5 py-2 rounded-full uppercase tracking-widest shadow-xl">
                        <CheckCircle2 className="w-5 h-5 stroke-[3]" /> ACCESO CONCEDIDO
                      </span>
                      <span className="text-sm text-slate-950 font-mono font-black bg-white/90 px-4 py-1.5 rounded-xl border-2 border-slate-950 shadow">
                        {lastResult.timestamp}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 my-6">
                      <img
                        src={lastResult.member.avatarUrl}
                        alt={lastResult.member.name}
                        className="w-40 h-40 sm:w-44 sm:h-44 rounded-3xl object-cover border-4 border-slate-950 shadow-2xl shrink-0"
                      />
                      <div className="text-center sm:text-left min-w-0">
                        <h3 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 leading-none tracking-tight drop-shadow">
                          {lastResult.member.name} <br /> {lastResult.member.lastName}
                        </h3>
                        <p className="text-xl sm:text-2xl text-slate-950 font-black uppercase tracking-wider mt-3 bg-white/80 px-3 py-1 rounded-xl inline-block border border-slate-950">
                          {lastResult.member.planName}
                        </p>
                        <p className="text-base sm:text-lg text-slate-950 font-mono font-bold mt-2">
                          C.I.: {lastResult.member.dni}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t-4 border-slate-950/30">
                      <div className="bg-white/90 p-4 sm:p-5 rounded-2xl border-2 border-slate-950 shadow">
                        <span className="block text-slate-800 text-xs sm:text-sm font-black uppercase tracking-wider mb-1">Estado Financiero</span>
                        <span className="text-xl sm:text-2xl font-black text-emerald-800">AL DÍA ($0.00)</span>
                      </div>
                      <div className="bg-white/90 p-4 sm:p-5 rounded-2xl border-2 border-slate-950 shadow">
                        <span className="block text-slate-800 text-xs sm:text-sm font-black uppercase tracking-wider mb-1">Vencimiento del Plan</span>
                        <span className="text-xl sm:text-2xl font-black text-slate-950">{lastResult.member.expirationDate}</span>
                      </div>
                    </div>

                    <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-15 pointer-events-none">
                      <Unlock className="w-96 h-96 text-slate-950" />
                    </div>
                  </div>
                )}

                {lastResult.status === 'DENIED' && (
                  <div className="bg-gradient-to-br from-rose-600 to-rose-700 border-4 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 text-white">
                    <div className="flex items-center justify-between mb-6">
                      <span className="inline-flex items-center gap-2 text-sm sm:text-base font-black bg-slate-950 text-rose-400 px-5 py-2 rounded-full uppercase tracking-widest shadow-xl">
                        <XCircle className="w-5 h-5 stroke-[3]" /> ACCESO DENEGADO
                      </span>
                      <span className="text-sm text-slate-950 font-mono font-black bg-white/90 px-4 py-1.5 rounded-xl border-2 border-slate-950 shadow">
                        {lastResult.timestamp}
                      </span>
                    </div>

                    {lastResult.member ? (
                      <>
                        <div className="flex flex-col sm:flex-row items-center gap-6 my-6">
                          <img
                            src={lastResult.member.avatarUrl}
                            alt={lastResult.member.name}
                            className="w-40 h-40 sm:w-44 sm:h-44 rounded-3xl object-cover border-4 border-slate-950 shadow-2xl grayscale shrink-0"
                          />
                          <div className="text-center sm:text-left min-w-0">
                            <h3 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-none tracking-tight drop-shadow">
                              {lastResult.member.name} <br /> {lastResult.member.lastName}
                            </h3>
                            <p className="text-xl sm:text-2xl text-slate-950 font-black uppercase tracking-wider mt-3 bg-white/90 px-3 py-1 rounded-xl inline-block border border-slate-950">
                              {lastResult.member.planName}
                            </p>
                            <p className="text-base sm:text-lg text-white font-mono font-bold mt-2">
                              C.I.: {lastResult.member.dni}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-950 border-2 border-white rounded-2xl p-5 mb-6 text-center shadow-2xl">
                          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-2 stroke-[2.5]" />
                          <p className="text-xl sm:text-2xl font-black text-white">{lastResult.reason}</p>
                          {lastResult.member.debtAmount > 0 && (
                            <p className="text-3xl font-black text-rose-400 mt-2 tracking-tight">
                              Saldo Adeudado: ${lastResult.member.debtAmount.toFixed(2)}
                            </p>
                          )}
                        </div>

                        {lastResult.member.debtAmount > 0 && (
                          <button
                            onClick={() => lastResult.member && onOpenPaymentModal(lastResult.member)}
                            className="w-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black py-5 px-6 rounded-2xl text-lg sm:text-xl flex items-center justify-center gap-3 shadow-2xl transition-transform hover:scale-[1.01] active:scale-95 border-2 border-slate-950"
                          >
                            <DollarSign className="w-7 h-7 stroke-[3]" />
                            REGISTRAR PAGO Y AUTORIZAR ENTRADA
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="py-12 text-center">
                        <AlertTriangle className="w-20 h-20 text-white mx-auto mb-4 stroke-[2.5]" />
                        <h3 className="text-3xl font-black text-white mb-2">Error de Verificación</h3>
                        <p className="text-xl font-bold text-rose-100">{lastResult.reason}</p>
                      </div>
                    )}

                    <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-15 pointer-events-none">
                      <Lock className="w-96 h-96 text-slate-950" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PANEL SECUNDARIO (5 cols): Historial de Pases en Vivo Claro */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-slate-200">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
                <History className="w-6 h-6 text-emerald-600 stroke-[2.5]" />
                Historial de Pases en Vivo
              </h3>
              <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm">
                Últimos {recentPasses.length} escaneos
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[520px] space-y-3.5 pr-1">
              {recentPasses.length === 0 ? (
                <div className="text-center py-16 text-slate-500 font-bold text-sm">
                  <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  No hay pases registrados aún en esta sesión.
                </div>
              ) : (
                recentPasses.map((pass) => {
                  const isGranted = pass.status === 'GRANTED';
                  return (
                    <div
                      key={pass.id}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 shadow-sm ${
                        isGranted
                          ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-500'
                          : 'bg-rose-50 border-rose-300 hover:border-rose-500'
                      }`}
                    >
                      {pass.avatarUrl ? (
                        <img
                          src={pass.avatarUrl}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover border-2 border-slate-300 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 text-slate-600 border-2 border-slate-300">
                          <User className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                            {pass.memberName}
                          </h4>
                          <span className="text-xs font-mono font-black text-slate-700 shrink-0 bg-white px-2 py-0.5 rounded border border-slate-300">
                            {pass.timestamp}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-700 truncate mt-1">
                          {pass.reason}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shadow">
                            <CheckCircle2 className="w-4 h-4 stroke-[3]" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs shadow">
                            <XCircle className="w-4 h-4 stroke-[3]" /> DENEGADO
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
