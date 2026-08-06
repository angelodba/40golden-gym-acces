import React from 'react';
import { NavLink } from 'react-router-dom';
import { Smartphone, Monitor, Users, History, Dumbbell } from 'lucide-react';

interface NavbarProps {
  debtorCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ debtorCount }) => {
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
                FITPASS
                <span className="text-[11px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-600 text-white uppercase shadow-sm">
                  GYM ACCESS
                </span>
              </h1>
              <p className="text-xs font-bold text-slate-600 hidden sm:block">
                Control de Acceso QR & Morosidad
              </p>
            </div>
          </div>

          {/* Navegación Clara de Alto Contraste */}
          <nav className="flex space-x-1.5 sm:space-x-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-base font-extrabold transition-all duration-150 relative border-2 ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 font-black scale-105'
                        : 'text-slate-800 bg-slate-100 hover:bg-slate-200 border-slate-300 hover:border-slate-400'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white stroke-[2.5]' : 'text-emerald-700'}`} />
                      <span className="hidden md:inline">{item.label}</span>
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
          </nav>
        </div>
      </div>
    </header>
  );
};
