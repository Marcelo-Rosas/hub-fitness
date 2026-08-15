import React from 'react';
import { usePlanner } from '../context/PlannerContext';
import { UserRole } from '../types';
import { LoginScreen } from './LoginScreen';
import { ShieldAlert, ArrowLeft, Lock, UserX, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  role?: UserRole | UserRole[] | 'CFO_ADMIN';
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role, children }) => {
  const { isAuthenticated, user, activeRole, setActiveModule, logout } = usePlanner();

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  // Determine allowed roles
  let allowedRoles: UserRole[] = [];
  if (role === 'CFO_ADMIN') {
    allowedRoles = ['cfo', 'socio'];
  } else if (Array.isArray(role)) {
    allowedRoles = role;
  } else if (role) {
    allowedRoles = [role];
  } else {
    // Default: all roles allowed
    allowedRoles = ['cfo', 'socio', 'comite', 'comercial', 'compras'];
  }

  const isAllowed = allowedRoles.includes(activeRole);

  if (!isAllowed) {
    const roleLabels: Record<UserRole, string> = {
      cfo: 'CFO / Controller Sênior',
      socio: 'Sócio-Fundador / Board',
      comite: 'Comitê de Risco & Auditoria',
      comercial: 'VP de Negócios / Comercial',
      compras: 'Assistente de Compras',
    };

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />
          
          <div className="inline-flex items-center justify-center p-4 bg-rose-500/10 text-rose-400 rounded-2xl mb-5 ring-1 ring-rose-500/20">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
            Acesso Negado — Permissão Insuficiente (RBAC)
          </h2>

          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            O seu perfil atual (<strong className="text-rose-400 font-semibold">{roleLabels[activeRole] || activeRole}</strong>) não possui privilégios de segurança para acessar este módulo.
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs mb-6 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span>Usuário Logado:</span>
              <span className="font-medium text-slate-200">{user.name}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Perfil Ativo:</span>
              <span className="font-semibold text-rose-400 uppercase">{activeRole}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Módulo Requer:</span>
              <span className="font-semibold text-emerald-400 uppercase">
                {role === 'CFO_ADMIN' ? 'CFO / Sócio' : allowedRoles.join(' / ')}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setActiveModule('M1')}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao M1 (Dashboard)</span>
            </button>
            <button
              onClick={logout}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
