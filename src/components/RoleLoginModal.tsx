import React from 'react';
import { usePlanner, BOARD_EMAIL_BY_ROLE, MOCK_BOARD_USERS } from '../context/PlannerContext';
import { USER_ROLES } from '../data/initialData';
import { UserRole } from '../types';
import { Shield, Check, ShieldAlert, ArrowRight, Eye, Edit3, Presentation } from 'lucide-react';

interface RoleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleLoginModal: React.FC<RoleLoginModalProps> = ({ isOpen, onClose }) => {
  const { activeRole, setActiveRole, setPitchMode, user } = usePlanner();

  if (!isOpen) return null;

  const handleSelectRole = (roleId: UserRole) => {
    setActiveRole(roleId);
    if (roleId === 'comercial') {
      setPitchMode(true);
    } else {
      setPitchMode(false);
    }
  };

  const getRoleIcon = (roleId: UserRole) => {
    switch (roleId) {
      case 'cfo':
        return <Edit3 className="w-5 h-5 text-blue-600" />;
      case 'socio':
        return <Shield className="w-5 h-5 text-purple-600" />;
      case 'comite':
        return <Eye className="w-5 h-5 text-amber-600" />;
      case 'comercial':
        return <Presentation className="w-5 h-5 text-emerald-600" />;
      case 'compras':
        return <Edit3 className="w-5 h-5 text-teal-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">FR-01 · Entrar como / Seleção de Papéis</h2>
              <p className="text-xs text-slate-400">
                Troca identidade board + e-mail (intranet / alçada)
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Selecione o papel — e-mail muda junto (não só a UI):
          </p>
          <p className="text-[11px] text-slate-500 -mt-1 mb-3">
            Sessão atual: <strong>{user?.name}</strong> · {user?.email}
          </p>

          {USER_ROLES.map((role) => {
            const isSelected = activeRole === role.id;
            const boardEmail = BOARD_EMAIL_BY_ROLE[role.id];
            const boardName = MOCK_BOARD_USERS[boardEmail]?.name;
            return (
              <div
                key={role.id}
                onClick={() => handleSelectRole(role.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3.5 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="p-2 bg-white rounded-md border border-slate-200 shadow-xs shrink-0 mt-0.5">
                  {getRoleIcon(role.id)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{role.name}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 shrink-0">
                      {role.canEdit
                        ? '[editar]'
                        : role.pitchModeOnly
                          ? '[Pitch Mode]'
                          : '[leitura + inspeção 🔒]'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-blue-700 mt-0.5 truncate">
                    {boardName} · {boardEmail}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{role.description}</p>
                </div>

                <div className="shrink-0 mt-1">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {activeRole === 'comite' && '🔒 Modo Comitê: Células editáveis exibirão cadeado.'}
            {activeRole === 'comercial' && '⛓ Pitch Mode forçado ativado.'}
            {activeRole === 'compras' && '🛒 RFQ: alçada sobe para CFO (Roberto).'}
            {activeRole === 'cfo' && '✏️ Aprova RFQ de Compras em M19.'}
            {activeRole === 'socio' && '🏛 Aprova pedido cujo autor foi o CFO (four-eyes).'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-xs shrink-0"
          >
            Continuar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
