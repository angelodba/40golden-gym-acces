import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { hashPassword, verifyPassword, generateOtpCode } from '../lib/crypto';

export type UserRole = 'admin' | 'receptionist' | 'scanner_operator';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

interface StoredLocalUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
}

interface OtpRecoverySession {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; otpCode?: string }>;
  verifyResetOtp: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  failedLoginAttempts: number;
  isLockedOut: boolean;
  lockoutTimeRemaining: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '40golden_session_user_v1';
const LOCAL_USERS_KEY = '40golden_secure_vault_users_v1';
const INITIAL_ADMIN_SALT = 'e4a3b8c9d0e1f2a3b4c5d6e7f8a9b0c1'; // 16 bytes hex

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [failedLoginAttempts, setFailedLoginAttempts] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState<number>(0);
  const [activeOtpSession, setActiveOtpSession] = useState<OtpRecoverySession | null>(null);

  // Inicializar o actualizar credenciales de bóveda local para el administrador principal
  const ensureInitialVaultUser = async () => {
    try {
      const defaultPassword = 'GymSecure2026!';
      const { hash, salt } = await hashPassword(defaultPassword, INITIAL_ADMIN_SALT);
      const defaultUser: StoredLocalUser = {
        id: 'usr_admin_default_01',
        email: 'admin@40goldengym.com',
        name: 'Administrador Principal',
        role: 'admin',
        passwordHash: hash,
        salt: salt,
      };

      const existingRaw = localStorage.getItem(LOCAL_USERS_KEY);
      let localUsers: StoredLocalUser[] = [];
      if (existingRaw) {
        try {
          localUsers = JSON.parse(existingRaw);
        } catch {
          localUsers = [];
        }
      }

      const adminIdx = localUsers.findIndex((u) => u.email.toLowerCase() === 'admin@40goldengym.com');
      if (adminIdx === -1) {
        localUsers.push(defaultUser);
      } else {
        localUsers[adminIdx] = defaultUser;
      }

      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
    } catch (err) {
      console.error('Error al inicializar usuario admin en bóveda:', err);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isLockedOut && lockoutTimeRemaining > 0) {
      timer = setInterval(() => {
        setLockoutTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setFailedLoginAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLockedOut, lockoutTimeRemaining]);

  useEffect(() => {
    const initAuth = async () => {
      await ensureInitialVaultUser();

      // Si Supabase está configurado, sincronizar la sesión
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || 'admin@40goldengym.com',
            name: session.user.user_metadata?.full_name || 'Usuario Autenticado',
            role: (session.user.user_metadata?.role as UserRole) || 'admin',
          });
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || 'admin@40goldengym.com',
              name: session.user.user_metadata?.full_name || 'Usuario Autenticado',
              role: (session.user.user_metadata?.role as UserRole) || 'admin',
            });
          } else {
            setUser(null);
          }
        });

        setLoading(false);
        return () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        // Modo local seguro
        const stored = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (isLockedOut) {
      return {
        success: false,
        error: `Demasiados intentos fallidos. Bóveda bloqueada por ${lockoutTimeRemaining}s para prevenir fuerza bruta.`,
      };
    }

    const cleanEmail = email.trim().toLowerCase();

    // Intentar autenticación con Supabase si está disponible
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass,
        });

        if (!error && data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: data.user.user_metadata?.full_name || 'Usuario Autenticado',
            role: (data.user.user_metadata?.role as UserRole) || 'admin',
          };
          setUser(authUser);
          sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
          setFailedLoginAttempts(0);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Fallback a bóveda local por fallo de conexión Supabase:', err);
      }
    }

    // Autenticación en Bóveda Criptográfica Local (PBKDF2 SHA-256)
    const localUsersRaw = localStorage.getItem(LOCAL_USERS_KEY);
    const localUsers: StoredLocalUser[] = localUsersRaw ? JSON.parse(localUsersRaw) : [];

    const targetUser = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!targetUser) {
      handleFailedAttempt();
      return { success: false, error: 'Usuario no encontrado o credenciales incorrectas.' };
    }

    const isValid = await verifyPassword(pass, targetUser.passwordHash, targetUser.salt);
    if (!isValid) {
      handleFailedAttempt();
      return { success: false, error: 'Contraseña incorrecta. Revisa tus datos.' };
    }

    const sessionUser: AuthUser = {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
    };

    setUser(sessionUser);
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
    setFailedLoginAttempts(0);
    return { success: true };
  };

  const handleFailedAttempt = () => {
    setFailedLoginAttempts((prev) => {
      const next = prev + 1;
      if (next >= 4) {
        setIsLockedOut(true);
        setLockoutTimeRemaining(60); // Bloqueo de 60 segundos
      }
      return next;
    });
  };

  const logout = async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Recuperación de Contraseña
  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message: string; otpCode?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (!error) {
        return {
          success: true,
          message: 'Se ha enviado un enlace de recuperación a tu correo electrónico.',
        };
      }
    }

    // Modo Bóveda Criptográfica Local (Generación OTP Seguro)
    const localUsersRaw = localStorage.getItem(LOCAL_USERS_KEY);
    const localUsers: StoredLocalUser[] = localUsersRaw ? JSON.parse(localUsersRaw) : [];
    const targetUser = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!targetUser) {
      return {
        success: false,
        message: 'No existe una cuenta registrada con este correo electrónico en la bóveda.',
      };
    }

    const code = generateOtpCode(6);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos de validez

    setActiveOtpSession({
      email: cleanEmail,
      code,
      expiresAt,
      attempts: 0,
    });

    return {
      success: true,
      message: `Código de Seguridad Criptográfico (OTP) generado con éxito.`,
      otpCode: code,
    };
  };

  const verifyResetOtp = async (email: string, code: string): Promise<{ success: boolean; error?: string }> => {
    if (!activeOtpSession || activeOtpSession.email !== email.trim().toLowerCase()) {
      return { success: false, error: 'No hay una solicitud de recuperación activa para este correo.' };
    }

    if (Date.now() > activeOtpSession.expiresAt) {
      setActiveOtpSession(null);
      return { success: false, error: 'El código OTP ha expirado. Solicita uno nuevo.' };
    }

    if (activeOtpSession.attempts >= 3) {
      setActiveOtpSession(null);
      return { success: false, error: 'Superado el límite de intentos de verificación OTP.' };
    }

    if (activeOtpSession.code !== code.trim()) {
      setActiveOtpSession({
        ...activeOtpSession,
        attempts: activeOtpSession.attempts + 1,
      });
      return { success: false, error: 'Código de verificación incorrecto. Revisa e intentalo de nuevo.' };
    }

    return { success: true };
  };

  const resetPassword = async (email: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Actualizar en Bóveda Criptográfica Local
    const localUsersRaw = localStorage.getItem(LOCAL_USERS_KEY);
    let localUsers: StoredLocalUser[] = localUsersRaw ? JSON.parse(localUsersRaw) : [];

    const userIndex = localUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (userIndex === -1) {
      return { success: false, error: 'Usuario no encontrado en la bóveda local.' };
    }

    const { hash, salt } = await hashPassword(newPass);
    localUsers[userIndex].passwordHash = hash;
    localUsers[userIndex].salt = salt;

    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
    setActiveOtpSession(null);

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        requestPasswordReset,
        verifyResetOtp,
        resetPassword,
        failedLoginAttempts,
        isLockedOut,
        lockoutTimeRemaining,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
