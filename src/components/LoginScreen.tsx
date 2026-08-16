import React, { useState } from 'react';
import { usePlanner, MOCK_BOARD_USERS } from '../context/PlannerContext';
import { ShieldCheck, Lock, Mail, ArrowRight, Building2, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const { login } = usePlanner();
  // Prefill só em build de desenvolvimento (produção: campos vazios)
  const isDev = process.env.NODE_ENV !== 'production';
  const [email, setEmail] = useState(isDev ? 'cfo@hubfitness.com.br' : '');
  const [password, setPassword] = useState(isDev ? 'hub2026' : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || 'Credenciais inválidas.');
      }
    } catch (err: any) {
      setError('Erro ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(isDev ? quickPass : '');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none font-sans relative overflow-hidden">
      {/* Visual background lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-linear-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl shadow-blue-500/10 mb-4 ring-1 ring-white/20">
            <Building2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            HUB-SIM <span className="text-blue-400 font-normal">3PL Planner v3.5</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-xs mx-auto">
            Ecossistema de Simulação Logística & Governança Executiva Itajaí / SANCO
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Autenticação de Segurança (RBAC)</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SSL / Encrypted
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-300 text-xs animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail do Membro do Board
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu.email@hubfitness.com.br"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2 border border-blue-400/20 disabled:opacity-50"
            >
              {loading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <span>Entrar no Painel Executivo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Select Board Profiles for Seamless Audit */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span>Atalhos de Acesso Rápido ao Board</span>
              </span>
              <span className="text-[10px] text-slate-500">Demo Mode</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MOCK_BOARD_USERS).map(([uEmail, uData]) => {
                const isSelected = email === uEmail;
                return (
                  <button
                    key={uEmail}
                    type="button"
                    onClick={() => handleQuickSelect(uEmail, uData.pass)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/50'
                        : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-slate-200 truncate">{uData.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-1" />}
                    </div>
                    <span className="text-[10px] text-blue-400 font-medium truncate">{uData.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          HUB-SIM v3.5 &bull; Auditado pelo Comitê de Risco &bull; Itajaí/SC
        </div>
      </div>
    </div>
  );
};
