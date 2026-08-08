import React from 'react';
import { NavLink } from 'react-router-dom';
import { Smartphone, Monitor, Users, History, Dumbbell, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  debtorCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ debtorCount }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/scanner', label: 'Escáner Móvil', icon: Smartphone, badge: null },
    { path: '/reception', label: 'Pantalla Recepción', icon: Monitor, badge: null },
    { path: '/admin/members', label: 'Gestión Socios', icon: Users, badge: debtorCount > 0 ? `${debtorCount} moroso(s)` : null },
    { path: '/admin/logs', label: 'Historial Accesos', icon: History, badge: null },
  ];

  return (
    <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo de Alta Visibilidad para Día */}
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/30 shrink-0 border-2 border-emerald-500">
              <Dumbbell className="w-7 h-7 stroke-[3]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                40GOLDEN GYM
                <span className="text-[11px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-600 text-white uppercase shadow-sm">
                  CONTROL ACCESO
                </span>
              </h1>
              <p className="text-xs font-bold text-slate-600 hidden sm:block">
                Control de Acceso QR & Morosidad
              </p>
            </div>
          </div>

          {/* Navegación Clara de Alto Contraste */}
          <nav className="flex items-center space-x-1.5 sm:space-x-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-150 relative border-2 ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 font-black scale-105'
                        : 'text-slate-800 bg-slate-100 hover:bg-slate-200 border-slate-300 hover:border-slate-400'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white stroke-[2.5]' : 'text-emerald-700'}`} />
                      <span className="hidden lg:inline">{item.label}</span>
                      {item.badge && (
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-full shadow ${isActive ? 'bg-amber-400 text-slate-950' : 'bg-rose-600 text-white'}`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}

            {/* Usuario Autenticado & Botón Logout */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l-2 border-slate-200 ml-1 sm:ml-2">
                <div className="hidden xl:flex flex-col text-right">
                  <span className="text-xs font-black text-slate-900 truncate max-w-[140px]">
                    {user.name}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center justify-end gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {user.role}
                  </span>
                </div>

                <button
                  onClick={() => logout()}
                  title="Cerrar Sesión Segura"
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 rounded-xl text-xs font-black transition shadow-sm"
                >
                  <LogOut className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

