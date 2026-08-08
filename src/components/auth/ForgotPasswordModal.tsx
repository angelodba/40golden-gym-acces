import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { checkPasswordStrength } from '../../lib/crypto';
import { KeyRound, Mail, ShieldCheck, Lock, AlertTriangle, CheckCircle2, ArrowRight, X, Timer } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose, onSuccessLogin }) => {
  const { requestPasswordReset, verifyResetOtp, resetPassword } = useAuth();

  const [step, setStep] = useState<'request' | 'verify' | 'new_password' | 'completed'>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedOtpDemo, setGeneratedOtpDemo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const strength = checkPasswordStrength(newPassword);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Por favor introduce un correo electrónico válido.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setLoading(false);

      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }

      setSuccessMsg(res.message);
      if (res.otpCode) {
        setGeneratedOtpDemo(res.otpCode);
      }
      setStep('verify');
    } catch (err: any) {
      setLoading(false);
      setErrorMsg('Error al solicitar la recuperación: ' + err.message);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!otpCode || otpCode.length < 6) {
      setErrorMsg('Introduce el código de verificación OTP completo de 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyResetOtp(email, otpCode);
      setLoading(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Código incorrecto');
        return;
      }

      setSuccessMsg('Código validado con éxito. Ahora define tu nueva contraseña segura.');
      setStep('new_password');
    } catch (err: any) {
      setLoading(false);
      setErrorMsg('Error al verificar código: ' + err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres para garantizar alta seguridad.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(email, newPassword);
      setLoading(false);

      if (!res.success) {
        setErrorMsg(res.error || 'Error al actualizar la contraseña.');
        return;
      }

      setStep('completed');
    } catch (err: any) {
      setLoading(false);
      setErrorMsg('Error al guardar la nueva clave: ' + err.message);
    }
  };

  const resetModalState = () => {
    setStep('request');
    setEmail('');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setGeneratedOtpDemo(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transform transition-all duration-300">
        {/* Header con estilo dinámico */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={resetModalState}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Recuperación de Contraseña</h2>
              <p className="text-xs text-slate-300 font-medium">Bóveda Criptográfica & Control OTP 100% Seguro</p>
            </div>
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border-2 border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-shake">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && step !== 'completed' && (
            <div className="mb-4 p-3.5 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Solicitar Email */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                Ingresa el correo electrónico asociado a tu cuenta. Se generará una clave OTP criptográfica para autorizar la actualización de credenciales.
              </p>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  Correo Electrónico Registrado
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="admin@40goldengym.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loading ? 'Generando OTP Criptográfico...' : 'Generar Código de Seguridad OTP'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: Verificar OTP */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center gap-3">
                <Timer className="w-6 h-6 text-amber-600 shrink-0" />
                <div className="text-xs font-bold text-amber-900">
                  <p>Código enviado a: <span className="font-black underline">{email}</span></p>
                  <p className="text-[11px] font-medium text-amber-700">El código expirará en 5 minutos (Máx. 3 intentos).</p>
                </div>
              </div>

              {generatedOtpDemo && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-emerald-500/50 text-center shadow-inner">
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest block mb-1">
                    [DEMO BÓVEDA SEGURA] CÓDIGO GENERADO:
                  </span>
                  <div className="text-3xl font-black tracking-widest text-emerald-400 font-mono">
                    {generatedOtpDemo}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  Código de Verificación OTP (6 dígitos)
                </label>
                <div className="relative">
                  <ShieldCheck className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-xl font-mono font-black text-slate-900 tracking-widest focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? 'Verificando...' : 'Verificar Código OTP'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Nueva Contraseña */}
          {step === 'new_password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-xs font-semibold text-slate-600">
                Define tu nueva clave con protección hashing PBKDF2-HMAC-SHA256 (100,000 iteraciones).
              </p>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Nueva Contraseña Segura
                </label>
                <div className="relative mb-2">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Medidor visual de fortaleza */}
                {newPassword && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">Fortaleza:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${strength.color}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          strength.score >= 5
                            ? 'bg-emerald-500'
                            : strength.score >= 3
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${(strength.score / 5) * 100}%` }}
                      ></div>
                    </div>
                    {strength.feedback.length > 0 && (
                      <ul className="text-[11px] text-slate-500 space-y-0.5 pl-1">
                        {strength.feedback.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repite la nueva clave"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPasswordCheck"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="showPasswordCheck" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Mostrar contraseña
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loading ? 'Encriptando & Actualizando...' : 'Guardar Nueva Contraseña Segura'}
              </button>
            </form>
          )}

          {/* STEP 4: Completado */}
          {step === 'completed' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-2 border-emerald-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900">¡Contraseña Actualizada con Éxito!</h3>
              <p className="text-xs font-semibold text-slate-600">
                Tu clave ha sido re-encriptada en la Bóveda Criptográfica con algoritmo PBKDF2 SHA-256. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button
                onClick={() => {
                  resetModalState();
                  onSuccessLogin();
                }}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition"
              >
                Iniciar Sesión Ahora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
