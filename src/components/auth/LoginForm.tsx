import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Dumbbell, Lock, Mail, Shield, AlertTriangle, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';

interface LoginFormProps {
  onSuccessLogin?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccessLogin }) => {
  const { login, isLockedOut, lockoutTimeRemaining, failedLoginAttempts } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(email, password);
      setLoading(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Credenciales incorrectas.');
        return;
      }

      if (onSuccessLogin) {
        onSuccessLogin();
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg('Error en el sistema de acceso: ' + err.message);
    }
  };

  const handleFillDemoAdmin = async () => {
    const demoEmail = 'admin@40goldengym.com';
    const demoPass = 'GymSecure2026!';
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await login(demoEmail, demoPass);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al iniciar sesión con credenciales demo.');
      } else if (onSuccessLogin) {
        onSuccessLogin();
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg('Error en el acceso demo: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center px-4 py-8 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Decorator Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border-2 border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3.5 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/30 mb-3 border-2 border-emerald-500">
            <Dumbbell className="w-8 h-8 stroke-[3]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            40GOLDEN GYM
            <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase">
              BÓVEDA SEGURA 100%
            </span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Sistema Seguro de Control de Acceso Criptográfico
          </p>
        </div>

        {/* Anti Brute Force Warning / Lockout */}
        {isLockedOut ? (
          <div className="mb-6 p-4 bg-rose-950/80 border-2 border-rose-600/80 rounded-2xl text-rose-200 text-xs font-bold flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-6 h-6 shrink-0 text-rose-500 animate-pulse mt-0.5" />
            <div>
              <p className="font-black text-white text-sm">Bóveda Criptográfica Bloqueada</p>
              <p className="mt-1">
                Se detectaron múltiples intentos erróneos. Por seguridad 100%, el acceso estará bloqueado durante{' '}
                <span className="text-amber-400 font-mono font-black text-sm">{lockoutTimeRemaining}s</span>.
              </p>
            </div>
          </div>
        ) : failedLoginAttempts > 0 && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Intentos fallidos: {failedLoginAttempts} / 4 (Bloqueo preventivo tras 4 fallos)</span>
          </div>
        )}

        {errorMsg && !isLockedOut && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border-2 border-rose-500/50 text-rose-300 rounded-2xl text-xs font-bold flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
              Usuario / Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                disabled={isLockedOut}
                placeholder="admin@40goldengym.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border-2 border-slate-700 rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-xs font-extrabold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isLockedOut}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-slate-900/80 border-2 border-slate-700 rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isLockedOut}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/30 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-400/40"
          >
            {loading ? (
              <span>Verificando Bóveda Criptográfica...</span>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span>Ingresar al Sistema Seguro</span>
              </>
            )}
          </button>
        </form>

        {/* Credenciales Demo Rápidas */}
        <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
          <p className="text-[11px] font-bold text-slate-400 mb-2">
            Modo Demostración / Acceso Inicial del Sistema:
          </p>
          <button
            type="button"
            onClick={handleFillDemoAdmin}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-950 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-xs font-mono text-emerald-400 flex items-center justify-center gap-2 mx-auto transition shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Cargar Credenciales Admin Demo</span>
          </button>
        </div>
      </div>

      {/* Footer Security Badges */}
      <div className="mt-6 text-center text-xs font-bold text-slate-400 space-y-1">
        <p className="flex items-center justify-center gap-1.5">
          <Shield className="w-4 h-4 text-emerald-400" />
          PBKDF2-HMAC-SHA256 • Salt 128-bit • Protegido contra Ataques por Tiempo
        </p>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onSuccessLogin={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
};
