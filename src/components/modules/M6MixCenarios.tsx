import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { M6Cenarios } from './M6Cenarios';
import { M11SimuladorMix } from './M11SimuladorMix';

export const M6MixCenarios: React.FC = () => {
  const { isMixDirty } = usePlanner();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Mix & Cenários</h1>
          {isMixDirty && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Mix pendente
            </span>
          )}
        </div>
      </div>
      <M11SimuladorMix embedPanel="simulator" />
      <M6Cenarios embed />
    </div>
  );
};
