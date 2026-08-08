import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoginForm } from './LoginForm';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-['Plus_Jakarta_Sans',sans-serif]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-sm font-black text-slate-300">Verificando Bóveda de Autenticación 40GOLDEN GYM...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
};
