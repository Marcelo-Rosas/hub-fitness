import React, { useEffect, useState } from 'react';
import { GitCompare, Sliders, Target, FileText, BookOpen, AlertTriangle } from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { M6Cenarios } from './M6Cenarios';
import { M11SimuladorMix } from './M11SimuladorMix';
import { M11PlanoDeContas } from './M11PlanoDeContas';

export type M6UnifiedTab = 'mix' | 'matriz' | 'enquadramento' | 'board_memo' | 'plano_contas';

const TAB_FROM_URL: Record<string, M6UnifiedTab> = {
  mix: 'mix',
  simulator: 'mix',
  matriz: 'matriz',
  enquadramento: 'enquadramento',
  board_memo: 'board_memo',
  plano_contas: 'plano_contas',
};

function readTabFromUrl(): M6UnifiedTab {
  if (typeof window === 'undefined') return 'mix';
  const raw = new URLSearchParams(window.location.search).get('tab') || 'mix';
  return TAB_FROM_URL[raw] ?? 'mix';
}

const TABS: { id: M6UnifiedTab; label: string; icon: React.ElementType }[] = [
  { id: 'mix', label: 'Mix & Receitas', icon: Sliders },
  { id: 'matriz', label: 'Matriz & Tornado', icon: GitCompare },
  { id: 'enquadramento', label: 'Enquadramento', icon: Target },
  { id: 'board_memo', label: 'Board Memo', icon: FileText },
  { id: 'plano_contas', label: 'Plano de Contas', icon: BookOpen },
];

export const M6MixCenarios: React.FC = () => {
  const { isMixDirty } = usePlanner();
  const [tab, setTab] = useState<M6UnifiedTab>(() => readTabFromUrl());

  useEffect(() => {
    const onPop = () => setTab(readTabFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selectTab = (next: M6UnifiedTab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set('module', 'M6');
    params.set('tab', next);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Módulo M6
            </span>
            {isMixDirty && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Mix pendente
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Mix & Cenários</h1>
          <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
            Simulação unificada: Mix em preview até Commit; drivers de cenário com autosave; CoA somente leitura.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/80 p-1.5 rounded-xl border border-slate-300/80">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              tab === id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-300'
                : 'text-slate-600 hover:bg-slate-100/80'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'mix' && <M11SimuladorMix embedPanel="simulator" />}
      {tab === 'matriz' && <M6Cenarios embed />}
      {tab === 'enquadramento' && <M11SimuladorMix embedPanel="enquadramento" />}
      {tab === 'board_memo' && <M11SimuladorMix embedPanel="board_memo" />}
      {tab === 'plano_contas' && <M11PlanoDeContas readOnly />}
    </div>
  );
};
