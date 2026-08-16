import React, { useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { CheckCircle2, Zap } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { formatDasPct, formatFatorRBand } from '../../core/governanceMatrix';
import { fatorRFolhaMensalFromLedger, plAdditionalForMonth } from '../../core/engine';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';

export const M5FatorR: React.FC = () => {
  const {
    fatorR,
    applyFatorRTrigger,
    dreMonths,
    hubParams,
    ledgerBaseItems,
    prolaboreMonthly,
  } = usePlanner();
  const [simulateRevenueIncrease, setSimulateRevenueIncrease] = useState<boolean>(false);

  const bandMin = hubParams.fiscal.fatorRMin;
  const bandMax = hubParams.fiscal.fatorRMax;
  const bandLabel = formatFatorRBand(hubParams);
  const dasLabel = formatDasPct(hubParams);
  const anexoVPct = 15.5;

  const simulatedFatorR = simulateRevenueIncrease ? Number((fatorR * 0.947).toFixed(1)) : fatorR;
  const isOptimalBand = simulatedFatorR >= bandMin && simulatedFatorR <= bandMax;

  const rbt12 = useMemo(
    () => dreMonths.slice(0, 12).reduce((a, m) => a + m.receitaServicos, 0),
    [dreMonths],
  );
  const economiaAnual = isOptimalBand
    ? Math.round(rbt12 * (anexoVPct / 100 - hubParams.pricing.dasPct))
    : 0;

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M5"
        title="Fator R & Otimização Tributária Simples Nacional"
        subtitle={`Monitoramento contínuo da razão Folha de Pagamento / Receita Bruta acumulada de 12m para garantir tributação reduzida no Anexo III (${dasLabel}).`}
        kpis={[
          {
            label: 'Fator R Projetado',
            value: `${simulatedFatorR}%`,
            subtext: isOptimalBand ? `✓ Dentro da banda (${bandLabel})` : '⚠️ Fora da margem ideal',
            badge: 'TRIBUTÁRIO',
            highlightColor: isOptimalBand ? 'emerald' : 'amber',
          },
          {
            label: 'Alíquota DAS Efetiva',
            value: isOptimalBand ? dasLabel : `${anexoVPct.toFixed(1).replace('.', ',')}%`,
            subtext: isOptimalBand ? 'Anexo III (Alíquota Mínima)' : 'Anexo V (Sem Fator R)',
            badge: 'TRIBUTO',
            highlightColor: isOptimalBand ? 'emerald' : 'rose',
          },
          {
            label: 'Pró-Labore Sócios (Mensal)',
            value: `R$ ${prolaboreMonthly.toLocaleString('pt-BR')}`,
            subtext: 'Valor de Pró-Labore ajustável',
            badge: 'FOLHA',
            highlightColor: 'indigo',
          },
          {
            label: 'Economia Tributária Anual',
            value: isOptimalBand ? `R$ ${(economiaAnual / 1000).toFixed(1)}k` : 'R$ 0,00',
            subtext: 'Comparativo Anexo III vs Anexo V (sobre RBT12)',
            badge: 'ECONOMIA',
            highlightColor: 'emerald',
          },
        ]}
      />

      {/* Main Gauge & Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gauge Visual Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs text-center flex flex-col items-center justify-center space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gauge Fator R Atual</div>

          <div className="relative w-40 h-24 flex items-end justify-center overflow-hidden">
            <div className="w-40 h-40 rounded-full border-12 border-slate-100 border-t-emerald-500 border-r-emerald-500 transform -rotate-45"></div>
            <div className="absolute bottom-0 text-center">
              <span className={`text-3xl font-black font-mono ${isOptimalBand ? 'text-emerald-600' : 'text-amber-600'}`}>
                {simulatedFatorR}%
              </span>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            isOptimalBand ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isOptimalBand
                ? `● Dentro da Banda Alvo (${bandLabel})`
                : `⚠ Fora da Banda Alvo (<${bandMin.toFixed(1).replace('.', ',')}%)`}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Mantendo o Fator R ≥ {bandMin.toFixed(1).replace('.', ',')}%, a empresa permanece no Anexo III do
            Simples Nacional com DAS efetivo de {dasLabel}.
          </p>
        </div>

        {/* Trigger Simulation Card */}
        <div className="md:col-span-2 bg-linear-to-br from-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-md border border-slate-700 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 font-bold text-xs rounded border border-amber-500/40 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                SIMULAÇÃO DE GATILHO AUTOMÁTICO
              </span>
              <button
                onClick={() => setSimulateRevenueIncrease(!simulateRevenueIncrease)}
                className="text-xs text-blue-300 hover:text-white underline font-mono"
              >
                {simulateRevenueIncrease ? 'Resetar Simulação' : 'Simular Receita +15%'}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {simulateRevenueIncrease ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-xs leading-relaxed">
                  <div className="font-bold text-amber-300 mb-1">
                    ⚠ Alerta de Risco Tributário: Fator R Projetado em {simulatedFatorR}%
                  </div>
                  Se a receita crescer +15% sem reajuste de prolabore/headcount, o Fator R cairá para{' '}
                  {simulatedFatorR}%, migrando para o Anexo V (DAS {anexoVPct.toFixed(1).replace('.', ',')}%).
                </div>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  O sistema monitora continuamente a relação Folha/Receita. Quando a receita expande, o gatilho automático sugere um ajuste preventivo no prolabore ou contratação de 2 novos FTEs operacionais.
                </p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">AÇÃO SUGERIDA PELO MODELO:</div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">
                Ajuste de Pró-labore (params) ou Contratar +2 FTEs
              </div>
            </div>

            <button
              onClick={applyFatorRTrigger}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>[Aplicar Gatilho]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Fator R Table M1-M24 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider">Tabela M1–M24: Comparativo Sem Ajuste vs Com Ajuste</h3>
          <span className="text-xs text-slate-400 font-mono">Banda Segura: {bandLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4">Mês</th>
                <th className="py-2.5 px-4 text-right">Receita Mensal</th>
                <th className="py-2.5 px-4 text-right">Folha + Prolabore</th>
                <th className="py-2.5 px-4 text-right">Fator R (Sem Ajuste)</th>
                <th className="py-2.5 px-4 text-right bg-emerald-50 text-emerald-900">Fator R (Ajustado v3.5)</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dreMonths.slice(0, 12).map((m) => {
                const ledger = ledgerBaseItems.length ? ledgerBaseItems : INITIAL_GRANULAR_DRE_ITEMS;
                const folha = fatorRFolhaMensalFromLedger(ledger, hubParams, m.month);
                const plExtra = plAdditionalForMonth(hubParams, m.month);
                const ratioOriginal = m.receitaServicos
                  ? ((folha - plExtra) / m.receitaServicos) * 100
                  : 0;
                const ratioAjustado = m.receitaServicos ? (folha / m.receitaServicos) * 100 : 0;
                const ok =
                  ratioAjustado >= bandMin && ratioAjustado <= bandMax;

                return (
                  <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-bold">{m.label}</td>
                    <td className="py-2.5 px-4 text-right">R$ {m.receitaServicos.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-4 text-right">R$ {folha.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{ratioOriginal.toFixed(1)}%</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-800 bg-emerald-50/60">
                      {ratioAjustado.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 font-bold rounded text-[10px] ${
                          ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ok ? '● OK (Anexo III)' : '⚠ Ajustar'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
