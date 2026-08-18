import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Building2,
  ShieldAlert,
  Award,
  FileCheck,
  Briefcase,
  BookOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { formatDasPct, formatFatorRBand, plPhaseBands } from '../../core/governanceMatrix';
import { plAdditionalForMonth } from '../../core/engine';
import { canEditFinance } from '../../core/rbac/moduleEdit';
import {
  availablePayrollCatalogEntries,
  findPayrollCatalogEntry,
  payrollCatalogLabel,
  payrollRoleFromCatalogEntry,
} from '../../core/payrollCargoCatalog';
import {
  MIX_COST_MODE_LABELS,
  MIX_COST_MODES,
  derivePayrollCharges,
  payrollAmount,
  payrollCcTone,
  payrollHcLabel,
  payrollHcTotal,
  payrollTotal,
  type PayrollChargeCell,
} from '../../core/payrollRoles';
import type { PayrollRole } from '../../types';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtCell = (v: PayrollChargeCell) => {
  if (v === null) return '—';
  if (v === 'isento') return 'Isento CLT';
  return `R$ ${fmt(v)}`;
};

const ccBadge = (tone: ReturnType<typeof payrollCcTone>) => {
  if (tone === 'blue') return 'bg-blue-100 text-blue-800';
  if (tone === 'amber') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

export const M15RhBenchmark: React.FC = () => {
  const {
    hubParams,
    payrollRoles,
    upsertPayrollRole,
    deletePayrollRole,
    activeRole,
    pitchMode,
  } = usePlanner();
  const canEdit = canEditFinance(activeRole) && !pitchMode;
  const band = formatFatorRBand(hubParams);
  const dasLabel = formatDasPct(hubParams);
  const plBands = plPhaseBands(hubParams);
  const plM4 = plAdditionalForMonth(hubParams, 4);
  const plM12 = plAdditionalForMonth(hubParams, 12);
  const plM13 = plAdditionalForMonth(hubParams, 13);
  const plBase = hubParams.fiscal.plBaseMonthly;
  const capacity = hubParams.capacity.totalPositions;

  const totals = {
    cct: payrollTotal(payrollRoles, 'cct'),
    mediana: payrollTotal(payrollRoles, 'mediana'),
    caged: payrollTotal(payrollRoles, 'caged'),
  };
  const hcTotal = payrollHcTotal(payrollRoles);

  const perilRole = payrollRoles.find((r) => r.perilPct > 0);
  const perilWith = perilRole ? derivePayrollCharges(perilRole, 'mediana') : null;
  const perilWithout = perilRole
    ? derivePayrollCharges({ ...perilRole, perilPct: 0 }, 'mediana')
    : null;
  const perilAmt = typeof perilWith?.periculosidade === 'number' ? perilWith.periculosidade : 0;
  const perilReflex =
    (typeof perilWith?.totalEncargos === 'number' ? perilWith.totalEncargos : 0) -
    (typeof perilWithout?.totalEncargos === 'number' ? perilWithout.totalEncargos : 0);
  const perilImpactHc = perilAmt + perilReflex;
  const perilHc = perilRole?.hc ?? 0;

  const patchRole = (role: PayrollRole, patch: Partial<PayrollRole>) => {
    upsertPayrollRole({ ...role, ...patch });
  };

  const [addCargoCatalogId, setAddCargoCatalogId] = useState('');
  const addableCargos = useMemo(
    () => availablePayrollCatalogEntries(payrollRoles),
    [payrollRoles],
  );

  useEffect(() => {
    if (addCargoCatalogId && !addableCargos.some((e) => e.catalogId === addCargoCatalogId)) {
      setAddCargoCatalogId(addableCargos[0]?.catalogId ?? '');
    }
  }, [addableCargos, addCargoCatalogId]);

  const handleAddPayrollRole = () => {
    const entry = findPayrollCatalogEntry(addCargoCatalogId);
    if (!entry) return;
    upsertPayrollRole(payrollRoleFromCatalogEntry(entry, `pr-${Date.now()}`));
    setAddCargoCatalogId('');
  };

  return (
    <div className="space-[#1F3864] space-y-6">
      <div className="bg-[#1F3864] text-white p-6 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-linear-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
              <Users className="w-4 h-4" />
              <span>Módulo M15 · Recursos Humanos & Governança Salarial</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Estrutura Organizacional & Benchmark Salarial SC
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Tabela de cargos do projeto (metadata). Encargos CLT derivados das alíquotas; Mix lê as
              mesmas linhas Piso CCT / Mediana SC / Média CAGED.
            </p>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-xs border border-emerald-500/30 px-4 py-2.5 rounded-lg text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold block">
              ● Status da Governança
            </span>
            <span className="text-sm font-mono font-bold text-white">Ancorado no BP v3.6</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Encargos auditáveis · Conta 5.2.01.09
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                {MIX_COST_MODE_LABELS.cct}
              </span>
              <span className="text-xs text-blue-700 font-bold block mt-0.5">cct_sc_2024_26</span>
            </div>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-mono font-bold rounded">
              {hcTotal.toLocaleString('pt-BR')} HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-slate-900">
              R$ {fmt(totals.cct)} <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Mesmo quadro (HC). Só o piso CCT muda o total.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                {MIX_COST_MODE_LABELS.mediana}
              </span>
              <span className="text-xs text-emerald-700 font-bold block mt-0.5">
                Capacidade {capacity.toLocaleString('pt-BR')} posições
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold rounded">
              {hcTotal.toLocaleString('pt-BR')} HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-emerald-800">
              R$ {fmt(totals.mediana)} <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Mediana SC — default do Mix BE.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                {MIX_COST_MODE_LABELS.caged}
              </span>
              <span className="text-xs text-amber-700 font-bold block mt-0.5">media_caged_sc</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-mono font-bold rounded">
              {hcTotal.toLocaleString('pt-BR')} HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-amber-900">
              R$ {fmt(totals.caged)} <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Média CAGED — teto competitivo, mesmo HC.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-amber-950 uppercase tracking-wide">
                Governança Fator R: Pró-Labore Adicional Discricionário (Conta 5.2.01.03)
              </h3>
              <span className="px-2.5 py-1 bg-amber-200 text-amber-900 text-xs font-mono font-bold rounded-full w-fit">
                Banda Alvo Safe: {band}
              </span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Além dos salários e pró-labore base (Conta 5.2.01.01), a estrutura conta com o{' '}
              <strong>Pró-Labore Adicional Discricionário</strong>. Evidenciar a Periculosidade (5.2.01.09)
              aumenta o numerador do Fator R e dá folga para reduzir o PL adicional.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">M1 a M3</span>
                <span className="text-sm font-black font-mono text-slate-900">+R$ 0 /mês</span>
                <span className="text-[10px] text-slate-500 block">
                  PL base R$ {plBase.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">
                  M{plBands[0]?.fromMonth ?? 4}+
                </span>
                <span className="text-sm font-black font-mono text-slate-900">
                  +R$ {plM4.toLocaleString('pt-BR')}/mês
                </span>
                <span className="text-[10px] text-slate-500 block">
                  (Total PL: R$ {(plBase + plM4).toLocaleString('pt-BR')})
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">
                  M{plBands[1]?.fromMonth ?? 12} (Ajuste)
                </span>
                <span className="text-sm font-black font-mono text-slate-900">
                  +R$ {plM12.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-slate-500 block">One-shot Balanço 12m</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">
                  M{plBands[2]?.fromMonth ?? 13}+
                </span>
                <span className="text-sm font-black font-mono text-slate-900">
                  +R$ {plM13.toLocaleString('pt-BR')}/mês
                </span>
                <span className="text-[10px] text-slate-500 block">
                  (Total PL: R$ {(plBase + plM13).toLocaleString('pt-BR')})
                </span>
              </div>
            </div>

            <div className="text-[11px] text-amber-950 font-medium bg-amber-100/80 p-2.5 rounded border border-amber-300 mt-2">
              💡 <strong>Blindagem Fiscal:</strong> Ao injetar esse adicional, a alíquota efetiva do DAS
              permanece em <strong>{dasLabel} (Anexo III)</strong> enquanto o Fator R fica na banda {band}.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h3 className="text-sm font-extrabold text-blue-950 uppercase tracking-wide">
              Conta Contábil · Adicional de Periculosidade
            </h3>
            <p className="text-xs text-blue-900 leading-relaxed">
              Na matriz v3.5 o adicional de 30% (NR-16) ficava diluído em “Encargos Diretos” do CC 002,
              sem coluna, percentual ou conta própria. Na v3.6 cria-se a analítica:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="bg-white border border-blue-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-blue-800 block">5.2.01.09</span>
                Adicional de Periculosidade (NR-16) · CC 002
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-slate-700 block">5.2.01.01</span>
                Salários e Ordenados
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-slate-700 block">5.2.01.06 / .05 / .04</span>
                FGTS · 13º · Férias + 1/3
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-amber-800 block">Rubrica 0311</span>
                Periculosidade 30% · base = salário base
              </div>
            </div>
            {perilRole && (
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Impacto evidenciado ≈ R$ {fmt(perilImpactHc)}/HC/mês (R$ {fmt(perilAmt)} + R${' '}
                {fmt(perilReflex)} de reflexos). Com {perilHc} HC ≈ +R${' '}
                {fmt(perilImpactHc * perilHc)}/mês — só se <code>perilPct</code> &gt; 0 (área inflamável).
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#1F3864]" />
              <span>Cargos e salários do projeto · metadata SC</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Encargos = FGTS 8% + 13º 8,33% + Férias+1/3 11,11% sobre (base + periculosidade). INSS
              patronal diluído no DAS (não entra nesta matriz). Mesma tabela do Mix.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded">
              Região: Itajaí & Navegantes / SC
            </span>
            <select
              disabled={!canEdit || addableCargos.length === 0}
              value={addCargoCatalogId}
              onChange={(e) => setAddCargoCatalogId(e.target.value)}
              className="max-w-[min(22rem,70vw)] h-8 px-2 text-[11px] border border-slate-300 bg-white text-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
              aria-label="Cargo do plano de contas"
            >
              <option value="">
                {addableCargos.length === 0
                  ? 'Todos os cargos do catálogo já incluídos'
                  : 'Plano de contas de cargos…'}
              </option>
              {addableCargos.map((entry) => (
                <option key={entry.catalogId} value={entry.catalogId}>
                  {payrollCatalogLabel(entry)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canEdit || !addCargoCatalogId}
              onClick={handleAddPayrollRole}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar cargo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse min-w-275">
            <thead>
              <tr className="bg-[#1F3864] text-white font-bold">
                <th className="py-2.5 px-3 sticky left-0 bg-[#1F3864] z-10 min-w-50">
                  Cargo / Função
                </th>
                <th className="py-2.5 px-2 text-center">CC</th>
                <th className="py-2.5 px-2 text-right">
                  HC
                  <span className="block text-[9px] font-normal text-white/70">quadro</span>
                </th>
                <th className="py-2.5 px-2 text-right bg-orange-900/50">
                  Periculosidade
                  <span className="block text-[9px] font-normal text-orange-100">NR-16 · %</span>
                </th>
                <th className="py-2.5 px-2 text-right">
                  FGTS
                  <span className="block text-[9px] font-normal text-white/70">8%</span>
                </th>
                <th className="py-2.5 px-2 text-right">
                  13º Salário
                  <span className="block text-[9px] font-normal text-white/70">8,33%</span>
                </th>
                <th className="py-2.5 px-2 text-right">
                  Férias + 1/3
                  <span className="block text-[9px] font-normal text-white/70">11,11%</span>
                </th>
                <th className="py-2.5 px-2 text-right bg-slate-800/40">
                  Total Encargos
                  <span className="block text-[9px] font-normal text-white/70">27,44%</span>
                </th>
                <th className="py-2.5 px-2 text-right bg-emerald-900/40">
                  Custo / HC
                  <span className="block text-[9px] font-normal text-emerald-100">Base + Enc.</span>
                </th>
                <th className="py-2.5 px-2 text-center bg-blue-900/60">
                  Piso CCT
                  <span className="block text-[9px] font-normal">conservador</span>
                </th>
                <th className="py-2.5 px-2 text-center bg-emerald-900/60">
                  Mediana SC
                  <span className="block text-[9px] font-normal">equilibrado</span>
                </th>
                <th className="py-2.5 px-2 text-center bg-amber-900/60">
                  Média CAGED
                  <span className="block text-[9px] font-normal">competitivo</span>
                </th>
                <th className="py-2.5 px-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payrollRoles.map((role) => {
                const charges = derivePayrollCharges(role, 'mediana');
                const highlight = role.contractKind === 'prolabore';
                return (
                  <tr
                    key={role.id}
                    className={`hover:bg-slate-50 ${highlight ? 'bg-amber-50/30' : ''}`}
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900 sticky left-0 bg-white z-1">
                      <input
                        disabled={!canEdit}
                        value={role.cargo}
                        onChange={(e) => patchRole(role, { cargo: e.target.value })}
                        className="w-full bg-transparent font-bold outline-none"
                      />
                      <input
                        disabled={!canEdit}
                        value={role.detail}
                        onChange={(e) => patchRole(role, { detail: e.target.value })}
                        className="w-full bg-transparent text-[10px] font-normal text-slate-500 outline-none"
                      />
                      <select
                        disabled={!canEdit}
                        value={role.contractKind}
                        onChange={(e) =>
                          patchRole(role, {
                            contractKind: e.target.value as PayrollRole['contractKind'],
                          })
                        }
                        className="mt-1 text-[10px] border border-slate-200 rounded px-1 py-0.5"
                      >
                        <option value="clt">CLT</option>
                        <option value="prolabore">Pró-labore</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <input
                        disabled={!canEdit}
                        value={role.cc}
                        onChange={(e) => patchRole(role, { cc: e.target.value })}
                        className={`w-16 text-center font-mono text-[10px] rounded font-bold px-1 py-0.5 ${ccBadge(payrollCcTone(role.cc))}`}
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      <input
                        type="number"
                        disabled={!canEdit}
                        value={role.hc}
                        onChange={(e) => patchRole(role, { hc: Number(e.target.value) || 0 })}
                        className="w-16 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-right"
                      />
                      <span className="block text-[9px] text-slate-500">{payrollHcLabel(role)}</span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono bg-orange-50/60">
                      {role.contractKind === 'prolabore' ? (
                        <span className="text-slate-500">{fmtCell(charges.periculosidade)}</span>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          <input
                            type="number"
                            step="1"
                            disabled={!canEdit}
                            value={Math.round(role.perilPct * 100)}
                            onChange={(e) =>
                              patchRole(role, { perilPct: (Number(e.target.value) || 0) / 100 })
                            }
                            className="w-14 bg-orange-50 border border-orange-200 rounded px-1 py-0.5 text-right"
                            title="Percentual NR-16"
                          />
                          {typeof charges.periculosidade === 'number' ? (
                            <span className="font-bold text-orange-800">
                              {Math.round(role.perilPct * 100)}% · R$ {fmt(charges.periculosidade)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                      {fmtCell(charges.fgts)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                      {fmtCell(charges.decimo)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                      {fmtCell(charges.ferias)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-800 bg-slate-50">
                      {fmtCell(charges.totalEncargos)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/50">
                      R$ {fmt(charges.custoHc)}
                    </td>
                    {MIX_COST_MODES.map((mode) => {
                      const field =
                        mode === 'cct'
                          ? 'salarioCct'
                          : mode === 'caged'
                            ? 'salarioCaged'
                            : 'salarioMediana';
                      const raw = role[field];
                      return (
                        <td
                          key={mode}
                          className={`py-2.5 px-2 text-center font-mono ${
                            mode === 'mediana' ? 'bg-emerald-50/40' : ''
                          } ${payrollAmount(role, mode) === 0 ? 'text-slate-400' : ''}`}
                        >
                          <input
                            type="number"
                            disabled={!canEdit}
                            value={raw ?? 0}
                            onChange={(e) =>
                              patchRole(role, {
                                [field]: Number(e.target.value) || 0,
                              })
                            }
                            className="w-20 mx-auto block bg-white border border-slate-200 rounded px-1 py-0.5 text-center font-bold text-slate-900"
                          />
                          <span className="block text-[10px] mt-0.5">
                            folha R$ {fmt(payrollAmount(role, mode))}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-2">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => deletePayrollRole(role.id)}
                        className="text-rose-600 disabled:opacity-40 cursor-pointer"
                        title="Excluir cargo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold">
                <td colSpan={9} className="py-3 px-3 uppercase text-right tracking-wide text-[10px]">
                  Total folha (metadata do projeto):
                </td>
                {MIX_COST_MODES.map((mode) => (
                  <td
                    key={mode}
                    className={`py-3 px-2 text-center font-mono text-sm ${
                      mode === 'mediana'
                        ? 'text-emerald-300 bg-emerald-950'
                        : mode === 'caged'
                          ? 'text-amber-300'
                          : 'text-sky-300'
                    }`}
                  >
                    {hcTotal.toLocaleString('pt-BR')} HC
                    <span className="block text-[11px]">R$ {fmt(payrollTotal(payrollRoles, mode))}</span>
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-2">
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>CCT Itajaí · SITRAROIT × SEVEÍCULOS</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pisos = proposta RH (F01–F07) até extrato Mediador. Empilhadeira: NR-11; periculosidade só
            área classificada (NR-16). Pack Mix = 27,44% Simples — INSS patronal no DAS.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-2">
            <Award className="w-4 h-4 text-emerald-700" />
            <span>Encargos CLT Simples Nacional</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Encargos diretos evidenciados: FGTS 8% + 13º 8,33% + Férias+1/3 11,11% ={' '}
            <strong>27,44%</strong>. INSS patronal diluído no DAS 6% (Anexo III) — fora desta matriz.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-2">
            <FileCheck className="w-4 h-4 text-amber-700" />
            <span>Capacitação WMS & Licença NR-11</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Treinamento obrigatório para leitores Zebra, acuracidade de inventário rotativo &gt;99,8% e
            formação NR-11 para manuseio do porta-paletes KONNEN.
          </p>
        </div>
      </div>
    </div>
  );
};
