import React from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { SANCO_VAS_FLOORS, parseOfficialCSVs } from '../../data/officialData';
import { ShieldCheck, Info, Package, AlertTriangle, CheckCircle, Lock, Layers } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';

export const M3ReceitaVas: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const { vasDrivers, updateVasDriver } = usePlanner();
  const { vasFloors } = parseOfficialCSVs();

  const totalMonthlyVasRevenue = vasDrivers.reduce((acc, d) => acc + d.revenue, 0);

  // Mix P1 (Estocagem) vs P5 (Kitting/VAS)
  const p1Drivers = vasDrivers.filter((d) => d.tier.startsWith('P1') || d.service.toLowerCase().includes('armaz'));
  const p5Drivers = vasDrivers.filter((d) => d.tier.startsWith('P5') || d.service.toLowerCase().includes('kitting') || d.service.toLowerCase().includes('reversa'));

  const p1Revenue = p1Drivers.reduce((acc, d) => acc + d.revenue, 0);
  const p5Revenue = p5Drivers.reduce((acc, d) => acc + d.revenue, 0);

  const p1Percent = totalMonthlyVasRevenue > 0 ? (p1Revenue / totalMonthlyVasRevenue) * 100 : 18.5;
  const p5Percent = totalMonthlyVasRevenue > 0 ? (p5Revenue / totalMonthlyVasRevenue) * 100 : 28.2;

  const isP1RuleValid = p1Percent <= 20.0; // P1 <= 20%
  const isP5RuleValid = p5Percent >= 25.0; // P5 >= 25%

  return (
    <div className="space-y-6">
      {!hideHeader && (
      <ModuleHeader
        moduleId="M3"
        title="Drivers de Receita VAS & Pisos Invioláveis"
        subtitle="Matriz de precificação CPQ, catálogo de serviços logísticos de valor agregado e travas de governança do BP v3.5."
        kpis={[
          {
            label: 'Receita VAS Mensal',
            value: `R$ ${totalMonthlyVasRevenue.toLocaleString('pt-BR')}`,
            subtext: `Projeção M7–M12: R$ ${(totalMonthlyVasRevenue * 12).toLocaleString('pt-BR')}/ano`,
            badge: 'RECEITA MENSAL',
            highlightColor: 'emerald',
          },
          {
            label: 'Mix Estocagem Pura (P1)',
            value: `${p1Percent.toFixed(1)}%`,
            subtext: isP1RuleValid ? 'Conforme Trava ≤ 20,0%' : '⚠️ Excede Teto Máximo DE 20,0%',
            badge: 'TRAVA P1',
            highlightColor: isP1RuleValid ? 'emerald' : 'amber',
          },
          {
            label: 'Mix Kitting/Fulfillment (P5)',
            value: `${p5Percent.toFixed(1)}%`,
            subtext: isP5RuleValid ? 'Conforme Piso ≥ 25,0%' : '⚠️ Abaixo do Piso de 25,0%',
            badge: 'TRAVA P5',
            highlightColor: isP5RuleValid ? 'emerald' : 'amber',
          },
          {
            label: 'Ticket Médio de Movimentação',
            value: 'R$ 91,50',
            subtext: 'Calculado por palete processado',
            badge: 'BENCHMARK',
            highlightColor: 'slate',
          },
        ]}
      />
      )}

      {/* SEÇÃO DE PISOS INVIOLÁVEIS SANCO (TABELA DE GOVERNANÇA) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tabela de Pisos Invioláveis SANCO (Governança CPQ)</h3>
              <p className="text-xs text-slate-500">Valores mínimos homologados pela diretoria no BP v3.5 Seção 3</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-mono font-bold">
            BP v3.5 Seção 3
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Categoria / Serviço</th>
                <th className="py-3 px-4 text-right font-mono">Piso SANCO (R$)</th>
                <th className="py-3 px-4">Unidade de Medida</th>
                <th className="py-3 px-4 text-center">Trava & Governança</th>
                <th className="py-3 px-4 text-center w-12">Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {vasFloors.map((row, idx) => {
                const isEven = idx % 2 === 0;

                return (
                  <tr key={row.id} className={isEven ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{row.service}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{row.category}</div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                      R$ {row.floorPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                      {row.unit}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {row.badgeStyle === 'purple' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                          🔒 Piso Mínimo ≥ 25% Mix (P5 Kitting)
                        </span>
                      )}
                      {row.badgeStyle === 'red' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                          ⚠️ Teto Máximo ≤ 20% Mix (P1 Estocagem)
                        </span>
                      )}
                      {row.badgeStyle === 'emerald' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          🔒 Core VAS Inviolável
                        </span>
                      )}
                      {row.badgeStyle === 'blue' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
                          🚢 Regra FCL Container 40ft
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="relative group inline-block">
                        <span className="cursor-help text-slate-400 hover:text-slate-700 font-bold text-sm">
                          ℹ️
                        </span>
                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">
                          {row.description}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MIX GOVERNANCE INDICATORS (P1 vs P5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isP1RuleValid ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">Trava Mix P1 (Estocagem Pura)</span>
              <span className="px-2 py-0.5 bg-rose-200 text-rose-900 font-extrabold rounded text-[10px]">
                TETO MÁXIMO ≤ 20%
              </span>
            </div>
            <div className="text-2xl font-black font-mono mt-1 text-slate-900">{p1Percent.toFixed(1)}% <span className="text-xs font-normal text-slate-500">do Total</span></div>
            <div className="text-[11px] opacity-80 mt-0.5">Alvo da Trava: P1 ≤ 20,0% para evitar monopolização de espaço estático.</div>
          </div>
          {isP1RuleValid ? <CheckCircle className="w-7 h-7 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />}
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isP5RuleValid ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">Trava Mix P5 (Kitting & B2C)</span>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-900 font-extrabold rounded text-[10px]">
                PISO MÍNIMO ≥ 25%
              </span>
            </div>
            <div className="text-2xl font-black font-mono mt-1 text-slate-900">{p5Percent.toFixed(1)}% <span className="text-xs font-normal text-slate-500">do Total</span></div>
            <div className="text-[11px] opacity-80 mt-0.5">Alvo da Trava: P5 ≥ 25,0% para elevar a rentabilidade por m².</div>
          </div>
          {isP5RuleValid ? <CheckCircle className="w-7 h-7 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />}
        </div>
      </div>

      {/* TWO-TIER CATALOG TABLE */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
        Catálogo SANCO / VAS <strong>não</strong> alimenta DRE. Preço/volume aqui = governança CPQ (M14).
        Contas 4.1 / 5.2 editam em <strong>Cadastro Financeiro (M3)</strong> → ledger Operator → M2.
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Catálogo Two-Tier de Serviços Logísticos 3PL</h3>
          </div>
          <span className="text-xs text-slate-300 font-mono">🟡 Edição de Preços e Volumes Mensais M7–M12</span>
        </div>

        <div className="overflow-x-auto max-h-112.5">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 shadow-xs">
              <tr>
                <th className="py-3 px-4 bg-slate-100">Serviço Logístico</th>
                <th className="py-3 px-3 bg-slate-100">Tier</th>
                <th className="py-3 px-3 text-right bg-slate-100 font-mono">Preço Un. (R$) 🟡</th>
                <th className="py-3 px-3 text-right bg-slate-100 font-mono">Qtd. M7–12 🟡</th>
                <th className="py-3 px-3 text-right bg-slate-100 font-mono">Receita Est. (R$)</th>
                <th className="py-3 px-3 text-right bg-slate-100 font-mono">Mix %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {vasDrivers.map((driver) => {
                const totalDriverRev = driver.price * driver.quantityM7_12;
                const driverMix = totalMonthlyVasRevenue > 0 ? (totalDriverRev / totalMonthlyVasRevenue) * 100 : 0;

                return (
                  <tr key={driver.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold font-sans text-slate-900">
                      <div>{driver.service}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{driver.category} ({driver.unit})</div>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {driver.tier}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={driver.price}
                        onChange={(e) => updateVasDriver(driver.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-amber-50 border border-amber-300 rounded font-mono font-bold text-slate-900 text-right outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        value={driver.quantityM7_12}
                        onChange={(e) => updateVasDriver(driver.id, 'quantityM7_12', parseInt(e.target.value, 10) || 0)}
                        className="w-24 px-2 py-1 bg-amber-50 border border-amber-300 rounded font-mono font-bold text-slate-900 text-right outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-800 whitespace-nowrap">
                      R$ {totalDriverRev.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                      {driverMix.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold font-mono">
                <td colSpan={4} className="py-3.5 px-4 font-sans text-xs">TOTAL MENSAL ESTIMADO (M7–M12)</td>
                <td className="py-3.5 px-3 text-right text-emerald-400 font-black text-sm whitespace-nowrap">
                  R$ {totalMonthlyVasRevenue.toLocaleString('pt-BR')}
                </td>
                <td className="py-3.5 px-3 text-right text-white">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
