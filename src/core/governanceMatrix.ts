/** Matriz de consistência M9 — checks derivados de params + estado live (não tudo `true`). */

import type { HubParams } from './params';
import { plAdditionalForMonth } from './engine';
import { OFFICIAL_DRE_MONTHS, OFFICIAL_TOTALS_24M } from './bpV35Reference';
import type { DreGranularItem, DreMonth, Scenario, VasDriver } from '../types';

export type ConsistencyStatus = 'passed' | 'warning' | 'critical';

export interface ConsistencyRow {
  id: string;
  dimension: string;
  reference: string;
  systemValue: string;
  status: ConsistencyStatus;
  action: string;
}

export interface ConsistencyInput {
  hubParams: HubParams;
  dreMonths: DreMonth[];
  activeScenario: Scenario;
  fatorR: number;
  vasDrivers: VasDriver[];
  granularDreItems?: DreGranularItem[];
  activeMix?: { p5?: number };
}

export function occupancyPositions(params: HubParams, occupancy = params.year3.galpaoAOccupancy): number {
  return Math.round(params.capacity.totalPositions * occupancy);
}

export function rentM13Monthly(params: HubParams): number {
  return Math.round(params.rent.baseMonthly * (1 + params.rent.igpmPct));
}

export function m7RevenueCeiling(params: HubParams): number {
  const officialM7 =
    OFFICIAL_DRE_MONTHS.find((m) => m.monthNum === 7)?.receitaServicos ?? 214_238;
  const baseCap = OFFICIAL_TOTALS_24M.capacidadePaletes || params.capacity.totalPositions;
  return Math.round(officialM7 * (params.capacity.totalPositions / baseCap));
}

export function formatFatorRBand(params: HubParams): string {
  const min = params.fiscal.fatorRMin.toFixed(2).replace('.', ',');
  const max = params.fiscal.fatorRMax.toFixed(2).replace('.', ',');
  return `${min}%–${max}%`;
}

export function formatDasPct(params: HubParams): string {
  return `${(params.pricing.dasPct * 100).toFixed(1).replace('.', ',')}%`;
}

export function plPhaseBands(params: HubParams): { fromMonth: number; amount: number; totalPl: number }[] {
  return params.fiscal.plAdditionalByPhase.map((p) => ({
    fromMonth: p.fromMonth,
    amount: p.amount,
    totalPl: params.fiscal.plBaseMonthly + p.amount,
  }));
}

export function buildConsistencyMatrix(input: ConsistencyInput): {
  rows: ConsistencyRow[];
  hasCritical: boolean;
} {
  const { hubParams, dreMonths, fatorR, vasDrivers, granularDreItems = [] } = input;
  void input.activeScenario; // CAPEX/LL live no cenário — rows usam ledger + params
  const cap = hubParams.capacity.totalPositions;
  const m7Ceiling = m7RevenueCeiling(hubParams);
  const m7Rev = dreMonths[6]?.receitaServicos ?? 0;
  const isM7RevOk =
    m7Rev > 0 &&
    (Math.abs(m7Rev - m7Ceiling) < 15_000 || m7Rev <= m7Ceiling + 5_000);

  const adValPct = hubParams.pricing.adValoremPct;
  const expectedAdVal = Math.round(m7Rev * adValPct);
  const isM7AdValOk = Math.abs(adValPct - 0.001) < 1e-9;

  const cvItem = granularDreItems.find((i) => i.accountCode === '5.1.04.01');
  const occPos = Math.round(cap * hubParams.capacity.targetOccupancy);
  const cvPos =
    cvItem && occPos > 0 ? Number((cvItem.monthlyAmountY1 / occPos).toFixed(2)) : 0;
  const isCvOk = (cvItem?.active && cvItem.monthlyAmountY1 > 0) || (dreMonths[6]?.custosOperacionais ?? 0) > 0;

  const isFatorROk = fatorR >= hubParams.fiscal.fatorRMin && fatorR <= hubParams.fiscal.fatorRMax;

  const moItem = granularDreItems.find((i) => i.accountCode === '5.1.02.01');
  const isMoTerceirizadaOk = !moItem || (moItem.section === 'custo' && moItem.active);

  const expectedRentM13 = rentM13Monthly(hubParams);
  const isAluguelM13Ok = expectedRentM13 > 0;

  const isVasCoreOk = vasDrivers.some((v) => {
    const s = v.service.toLowerCase();
    return s.includes('handling') || s.includes('descarga') || s.includes('reversa');
  });

  const pl4Item = granularDreItems.find((i) => i.accountCode === '4.1.04.01');
  const is4PLOk = !pl4Item || (pl4Item.active && /não-?base|nao-?base|upside/i.test(pl4Item.category + (pl4Item.notes ?? '')));

  const band = formatFatorRBand(hubParams);
  const plM7 = plAdditionalForMonth(hubParams, 7);

  const rows: ConsistencyRow[] = [
    {
      id: 'm7-rev',
      dimension: 'Receita Base M7',
      reference: `R$ ${m7Ceiling.toLocaleString('pt-BR')} (teto ${cap.toLocaleString('pt-BR')} pos)`,
      systemValue: `R$ ${m7Rev.toLocaleString('pt-BR')} ${isM7RevOk ? '(Conforme)' : '(Inconsistente)'}`,
      status: isM7RevOk ? 'passed' : 'critical',
      action: isM7RevOk
        ? `Conforme teto físico de ${cap.toLocaleString('pt-BR')} posições.`
        : `Recalcular Dashboard. Usar R$ ${m7Ceiling.toLocaleString('pt-BR')} como teto físico.`,
    },
    {
      id: 'm7-adval',
      dimension: 'Ad Valorem M7',
      reference: `${(adValPct * 100).toFixed(2).replace('.', ',')}% s/ NF (~R$ ${expectedAdVal.toLocaleString('pt-BR')}/mês)`,
      systemValue: isM7AdValOk
        ? `R$ ${expectedAdVal.toLocaleString('pt-BR')} / mês (params)`
        : `Alíquota ${(adValPct * 100).toFixed(3)}% fora do canônico 0,10%`,
      status: isM7AdValOk ? 'passed' : 'critical',
      action: isM7AdValOk
        ? 'Conforme Ad Valorem 0,10% sobre NF de serviço.'
        : 'Corrigir hubParams.pricing.adValoremPct para 0,001.',
    },
    {
      id: 'm7-cv',
      dimension: 'Custo Variável M7',
      reference: cvItem
        ? `R$ ${cvItem.monthlyAmountY1.toLocaleString('pt-BR')} (conta 5.1.04.01)`
        : 'Conta 5.1.04.01',
      systemValue:
        cvPos > 0
          ? `R$ ${cvPos.toFixed(2)} / posição`
          : cvItem
            ? `R$ ${cvItem.monthlyAmountY1.toLocaleString('pt-BR')}/mês`
            : 'CV não encontrado no ledger',
      status: isCvOk ? 'passed' : 'warning',
      action: 'Classificado no Plano de Contas conta 5.1.04.01 (CV por Posição).',
    },
    {
      id: 'fator-r-num',
      dimension: 'Fator R Numerador',
      reference: `CLT + PL Reg + PL Adic (${band})`,
      systemValue: `Fator R ${fatorR}% (${isFatorROk ? 'Banda Segura' : 'Ajustar'})`,
      status: isFatorROk ? 'passed' : 'critical',
      action: isFatorROk
        ? 'Numerador estrito (5.2.01.01+02+03) sem encargos nem terceirizados.'
        : `Ajustar Pró-labore Adicional (ref. R$ ${plM7.toLocaleString('pt-BR')}/mês em M7) para banda ${band}.`,
    },
    {
      id: 'mo-terceirizada',
      dimension: 'MO Terceirizada',
      reference: 'Excluída do Fator R (v3.1)',
      systemValue: moItem
        ? `Conta ${moItem.accountCode} (${moItem.section})`
        : 'Conta 5.1.02.01 (COGS/Custos)',
      status: isMoTerceirizadaOk ? 'passed' : 'warning',
      action: 'Mão de Obra Terceirizada mantida acima do Lucro Bruto.',
    },
    {
      id: 'aluguel-m13',
      dimension: 'Aluguel M13+',
      reference: `R$ ${expectedRentM13.toLocaleString('pt-BR')} (IGPM +${(hubParams.rent.igpmPct * 100).toFixed(0)}%)`,
      systemValue: `R$ ${expectedRentM13.toLocaleString('pt-BR')} / mês contratual`,
      status: isAluguelM13Ok ? 'passed' : 'warning',
      action: 'Reajuste contratual em M13 parametrizado no modelo.',
    },
    {
      id: 'vas-core',
      dimension: 'Serviços VAS Core',
      reference: 'Descarga Mec/Manual + Reversa',
      systemValue: isVasCoreOk ? 'Linhas VAS core ativas' : 'VAS core ausente',
      status: isVasCoreOk ? 'passed' : 'critical',
      action: isVasCoreOk
        ? 'Linhas obrigatórias ativas no catálogo VAS.'
        : 'Ativar Handling / Descarga / Reversa no catálogo VAS.',
    },
    {
      id: '4pl-ct',
      dimension: 'Receita 4PL CT',
      reference: 'Upside Não-Base (g7)',
      systemValue: pl4Item ? `Conta ${pl4Item.accountCode}` : 'Conta 4.1.04.01 (Não-Base)',
      status: is4PLOk ? 'passed' : 'warning',
      action: 'Taggeado como Receita Não-Base fora do Fator R.',
    },
  ];

  return { rows, hasCritical: rows.some((r) => r.status === 'critical') };
}

export interface PreErpCheck {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
}

export function buildPreErpChecklist(input: ConsistencyInput): PreErpCheck[] {
  const { hubParams, dreMonths, fatorR, activeMix } = input;
  const matrix = buildConsistencyMatrix(input);
  const m7Ok = matrix.rows.find((r) => r.id === 'm7-rev')?.status === 'passed';
  const fatorOk = fatorR >= hubParams.fiscal.fatorRMin && fatorR <= hubParams.fiscal.fatorRMax;
  const has4pl = (input.granularDreItems ?? []).some((i) => i.accountCode === '4.1.04.01' && i.active);
  const hasCv = (input.granularDreItems ?? []).some((i) => i.accountCode === '5.1.04.01' && i.active);
  const rentOk = rentM13Monthly(hubParams) > 0;
  const plOk = plAdditionalForMonth(hubParams, 7) >= 0;
  const p5 = activeMix?.p5 ?? 0;
  const vetoDocOk = p5 >= 20;

  return [
    {
      id: 'dash-vas',
      label: 'Recalcular Dashboard VAS',
      detail: `Usar R$ ${m7RevenueCeiling(hubParams).toLocaleString('pt-BR')} (M7 base) como teto físico.`,
      passed: !!m7Ok,
    },
    {
      id: 'coa',
      label: 'Atualizar Plano de Contas',
      detail: 'Inserir contas 4.1.04.01, 5.1.03.03 e 5.1.04.01.',
      passed: has4pl && hasCv,
    },
    {
      id: 'fator-r',
      label: 'Parametrizar Fator R',
      detail: 'Fórmula = (CLT + PL_Reg + PL_Adic) / RBT12.',
      passed: fatorOk,
    },
    {
      id: 'aluguel-m13',
      label: 'Reajuste Aluguel M13',
      detail: `Programar reajuste para R$ ${rentM13Monthly(hubParams).toLocaleString('pt-BR')} em M13.`,
      passed: rentOk,
    },
    {
      id: 'conciliacao',
      label: 'Conciliação DRE x FC',
      detail: `Explicar diferença do Pró-labore Adicional (M7: R$ ${plAdditionalForMonth(hubParams, 7).toLocaleString('pt-BR')}/mês).`,
      passed: plOk && (dreMonths?.length ?? 0) > 0,
    },
    {
      id: 'vetos',
      label: 'Documentar Vetos',
      detail: 'Rejeitar monoclientes e blends sem P5 (>20%).',
      passed: vetoDocOk,
    },
  ];
}
