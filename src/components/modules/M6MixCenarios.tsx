import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { kbHrefForModule } from '../../core/kb/visibility';
import { resolvePlannerSearch } from '../../core/m6LegacyRoutes';
import { M6ControlStrip } from './M6ControlStrip';
import { M6Cenarios } from './M6Cenarios';
import { M11SimuladorMix } from './M11SimuladorMix';

export const M6MixCenarios: React.FC = () => {
  const { isMixDirty, activeRole, setActiveModule } = usePlanner();
  const kbHref = kbHrefForModule(activeRole, 'M6');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            Mix & Cenários
            {kbHref && (
              <button
                type="button"
                aria-label="Base de conhecimento"
                title="Base de conhecimento"
                onClick={() => {
                  const route = resolvePlannerSearch(kbHref);
                  window.history.replaceState(null, '', kbHref);
                  setActiveModule(route.module);
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </h1>
          {isMixDirty && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
              <AlertTriangle className="w-3 h-3" />
              Mix pendente
            </span>
          )}
        </div>
      </div>
      <M6ControlStrip />
      <M11SimuladorMix embedPanel="simulator" />
      <M6Cenarios embed />
    </div>
  );
};
