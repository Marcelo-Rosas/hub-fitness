import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { INITIAL_SWOT } from '../../data/initialData';
import { SwotItem } from '../../types';
import {
  AlertTriangle,
  Zap,
  CheckCircle2,
  ShieldAlert,
  Building2,
  ArrowRight,
  TrendingDown,
  Info,
  Sparkles,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';

export const M8SpinOff: React.FC = () => {
  const { spinOffActive, setSpinOffActive } = usePlanner();
  const [loadCurve, setLoadCurve] = useState<number[]>([6.0, 6.1, 7.1, 7.4, 7.8]);
  const [selectedSwotItem, setSelectedSwotItem] = useState<SwotItem | null>(null);

  const rbt12Year5 = 4810000; // R$ 4,81M > TETO 4.8M
  const isAboveTeto = rbt12Year5 > 4800000;

  const handleCurveChange = (index: number, val: number) => {
    const updated = [...loadCurve];
    updated[index] = val;
    setLoadCurve(updated);
  };

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M8"
        title="Estratégia Spin-off 60m & Transição Tributária"
        subtitle="Curva de carga tributária estipulada por decreto, gatilho do teto R$ 4,8M do Simples Nacional e plano de desmembramento em SPE."
        kpis={[
          {
            label: 'RBT12 Projetado (Ano 5)',
            value: 'R$ 4,81M',
            subtext: '⚠️ Excede teto do Simples (R$ 4,8M)',
            badge: 'TETO SIMPLES',
            highlightColor: 'rose',
          },
          {
            label: 'Carga Efetiva Transição',
            value: `${loadCurve[4]}%`,
            subtext: 'Alíquota projetada no Ano 5',
            badge: 'REFORMA',
            highlightColor: 'amber',
          },
          {
            label: 'Estratégia de Spin-off',
            value: spinOffActive ? 'SPE ATIVADA' : 'SPE RECOMENDADA',
            subtext: spinOffActive ? 'Separação operando' : 'Aguardando gatilho de faturamento',
            badge: 'ESTRUTURA',
            highlightColor: spinOffActive ? 'emerald' : 'indigo',
          },
          {
            label: 'Economia Anual com SPE',
            value: 'R$ 142.500',
            subtext: 'Redução de carga fiscal via desmembramento',
            badge: 'GOVERNANÇA',
            highlightColor: 'emerald',
          },
        ]}
      />

      {/* Teto Alert Banner */}
      {isAboveTeto && (
        <div className="bg-rose-900 text-white p-4 rounded-xl shadow-md border border-rose-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>🚨 ALERTA DE ULTRAPASSAGEM DO TETO SIMPLES NACIONAL (RBT12 &gt; R$ 4,80M)</span>
              </div>
              <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                No Ano 5, a receita bruta acumulada atinge R$ 4.810.000, extrapolando o limite legal do Simples Nacional. Ative o Spin-off Corporativo para criar uma segunda PJ operacional e preservar a alíquota reduzida.
              </p>
            </div>
          </div>

          <button
            onClick={() => setSpinOffActive(!spinOffActive)}
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 shrink-0 transition-all ${
              spinOffActive
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{spinOffActive ? 'Spin-off ATIVO ⚡' : '[Abrir Simulador de Spin-off]'}</span>
          </button>
        </div>
      )}

      {/* Spin-off Impact Card */}
      {spinOffActive && (
        <div className="bg-emerald-950 text-emerald-100 p-5 rounded-xl border border-emerald-800 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              SIMULAÇÃO DE SPIN-OFF EXECUTADA COM SUCESSO
            </span>
            <span className="text-xs font-mono font-bold bg-emerald-900 text-emerald-200 px-2.5 py-0.5 rounded">
              NPV Gerado: +R$ 0,9M a +R$ 1,5M
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs font-mono">
            <div className="p-3 bg-emerald-900/60 rounded border border-emerald-800">
              <div className="text-[10px] text-emerald-300">Impacto Δ Ano 3</div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">+R$ 47.000</div>
            </div>
            <div className="p-3 bg-emerald-900/60 rounded border border-emerald-800">
              <div className="text-[10px] text-emerald-300">Impacto Δ Ano 4</div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">+R$ 52.000</div>
            </div>
            <div className="p-3 bg-emerald-900/60 rounded border border-emerald-800">
              <div className="text-[10px] text-emerald-300">Evitou Multa DAS (Ano 5)</div>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">−R$ 449.000</div>
            </div>
            <div className="p-3 bg-emerald-900/60 rounded border border-emerald-800">
              <div className="text-[10px] text-emerald-300">Estrutura Legal</div>
              <div className="text-sm font-bold text-white font-mono mt-0.5">Segregação 3PL / 4PL</div>
            </div>
          </div>
        </div>
      )}

      {/* Editable Load Curve Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">📈 Curva de Carga Tributária Editável (Ano 1 a Ano 5)</h3>
          <p className="text-xs text-slate-500">Ajuste as alíquotas efetivas de impostos conforme decretos da Reforma Tributária</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {loadCurve.map((rate, idx) => (
            <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-center">
              <div className="text-[11px] font-bold text-slate-600">Ano {idx + 1}</div>
              <div className="text-lg font-black text-blue-900 font-mono">{rate.toFixed(1)}%</div>
              <input
                type="range"
                min="5.0"
                max="12.0"
                step="0.1"
                value={rate}
                onChange={(e) => handleCurveChange(idx, Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* INTERACTIVE 2x2 SWOT MATRIX */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">🧩 Matriz SWOT Interativa 2×2 (Estratégia 3PL)</h3>
          <p className="text-xs text-slate-500">Passe o mouse ou clique no card para ver detalhamento estratégico de impacto</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Quadrant 1: Strengths */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center justify-between">
              <span>💪 Forças (Strengths)</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">Vantagem Competitiva</span>
            </div>
            {INITIAL_SWOT.filter((s) => s.type === 'strength').map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedSwotItem(item)}
                className="p-3 bg-white rounded-lg border border-emerald-200 cursor-pointer hover:shadow-xs hover:border-emerald-400 transition-all"
              >
                <div className="text-xs font-bold text-emerald-950">{item.title}</div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="text-[10px] font-bold text-emerald-700 mt-1.5">Impacto: {item.impact}</div>
              </div>
            ))}
          </div>

          {/* Quadrant 2: Weaknesses */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center justify-between">
              <span>⚠️ Fraquezas (Weaknesses)</span>
              <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Ponto de Atenção</span>
            </div>
            {INITIAL_SWOT.filter((s) => s.type === 'weakness').map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedSwotItem(item)}
                className="p-3 bg-white rounded-lg border border-amber-200 cursor-pointer hover:shadow-xs hover:border-amber-400 transition-all"
              >
                <div className="text-xs font-bold text-amber-950">{item.title}</div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="text-[10px] font-bold text-amber-700 mt-1.5">Impacto: {item.impact}</div>
              </div>
            ))}
          </div>

          {/* Quadrant 3: Opportunities */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center justify-between">
              <span>🚀 Oportunidades (Opportunities)</span>
              <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">Upside Operacional</span>
            </div>
            {INITIAL_SWOT.filter((s) => s.type === 'opportunity').map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedSwotItem(item)}
                className="p-3 bg-white rounded-lg border border-blue-200 cursor-pointer hover:shadow-xs hover:border-blue-400 transition-all"
              >
                <div className="text-xs font-bold text-blue-950">{item.title}</div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="text-[10px] font-bold text-blue-700 mt-1.5">Impacto: {item.impact}</div>
              </div>
            ))}
          </div>

          {/* Quadrant 4: Threats */}
          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center justify-between">
              <span>🛡️ Ameaças (Threats)</span>
              <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">Mitigação do Risco</span>
            </div>
            {INITIAL_SWOT.filter((s) => s.type === 'threat').map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedSwotItem(item)}
                className="p-3 bg-white rounded-lg border border-rose-200 cursor-pointer hover:shadow-xs hover:border-rose-400 transition-all"
              >
                <div className="text-xs font-bold text-rose-950">{item.title}</div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="text-[10px] font-bold text-rose-700 mt-1.5">Impacto: {item.impact}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SWOT Detail Modal */}
      {selectedSwotItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Análise SWOT Detalhada</h3>
              </div>
              <button
                onClick={() => setSelectedSwotItem(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-base font-bold text-slate-900">{selectedSwotItem.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{selectedSwotItem.description}</p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                Resultado & Impacto Esperado: {selectedSwotItem.impact}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSwotItem(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
