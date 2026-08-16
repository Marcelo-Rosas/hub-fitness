/**
 * AccountItem / CostCenter / DreGranularItem ↔ finance.* row shapes.
 */
import type { AccountItem, CostCenter } from '../../data/planoDeContasData';
import type { CostBehavior, DreCompositionLine, DreGranularItem, DreItemType, DreSection } from '../../types';

export type ChartAccountRow = {
  code: string;
  name: string;
  level: number;
  grp: string;
  nature: string;
  type: string;
  is_critical_fator_r: boolean;
  is_fator_r_numerator: boolean;
  is_fator_r_excluded: boolean;
  is_das_tax: boolean;
  is_capex: boolean;
  cost_center_id: string | null;
  notes: string;
  sort_order: number;
};

export type CostCenterRow = {
  id: string;
  name: string;
  description: string;
  scope: string;
  recommended_kpi: string;
};

export type LedgerLineRow = {
  id: string;
  section: string;
  item_type: string;
  category: string;
  name: string;
  monthly_amount_y1: number;
  monthly_amount_y2: number;
  active: boolean;
  is_percentage_of_revenue: boolean;
  percentage_value: number | null;
  account_code: string | null;
  cost_center_id: string | null;
  cost_behavior: string | null;
  engine_locked: boolean;
  manual_override: boolean;
  is_fator_r_numerator: boolean;
  is_fator_r_excluded: boolean;
  composition: unknown;
  notes: string;
};

export function costBehaviorValidationError(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v === 'variable' || v === 'fixed' || v === 'hc') return null;
  return `cost_behavior inválido: ${String(v)}`;
}

export function assertCostBehavior(v: unknown): CostBehavior | null {
  const err = costBehaviorValidationError(v);
  if (err) throw new Error(err);
  if (v == null || v === '') return null;
  return v as CostBehavior;
}

function optBool(v: boolean | undefined): boolean {
  return Boolean(v);
}

function flagOut(v: boolean): true | undefined {
  return v ? true : undefined;
}

export function accountToRow(a: AccountItem, sortOrder = 0): ChartAccountRow {
  return {
    code: a.code,
    name: a.name,
    level: a.level,
    grp: a.group,
    nature: a.nature,
    type: a.type,
    is_critical_fator_r: optBool(a.isCriticalFatorR),
    is_fator_r_numerator: optBool(a.isFatorRNumerator),
    is_fator_r_excluded: optBool(a.isFatorRExcluded),
    is_das_tax: optBool(a.isDasTax),
    is_capex: optBool(a.isCapex),
    cost_center_id: a.costCenterId ?? null,
    notes: a.notes ?? '',
    sort_order: sortOrder,
  };
}

export function rowToAccount(r: ChartAccountRow): AccountItem {
  const level = r.level as 1 | 2 | 3 | 4;
  return {
    code: r.code,
    name: r.name,
    level,
    group: r.grp as AccountItem['group'],
    nature: r.nature as AccountItem['nature'],
    type: r.type as AccountItem['type'],
    ...(flagOut(r.is_critical_fator_r) ? { isCriticalFatorR: true } : {}),
    ...(flagOut(r.is_fator_r_numerator) ? { isFatorRNumerator: true } : {}),
    ...(flagOut(r.is_fator_r_excluded) ? { isFatorRExcluded: true } : {}),
    ...(flagOut(r.is_das_tax) ? { isDasTax: true } : {}),
    ...(flagOut(r.is_capex) ? { isCapex: true } : {}),
    ...(r.cost_center_id ? { costCenterId: r.cost_center_id } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
  };
}

export function costCenterToRow(c: CostCenter): CostCenterRow {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    scope: c.scope,
    recommended_kpi: c.recommendedKPI,
  };
}

export function rowToCostCenter(r: CostCenterRow): CostCenter {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    scope: r.scope,
    recommendedKPI: r.recommended_kpi,
  };
}

function parseComposition(raw: unknown): DreCompositionLine[] | undefined {
  if (raw == null) return undefined;
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr.map((line) => {
    const o = line as Record<string, unknown>;
    return {
      id: String(o.id ?? ''),
      name: String(o.name ?? ''),
      ...(o.formula != null ? { formula: String(o.formula) } : {}),
      monthlyAmountY1: Number(o.monthlyAmountY1 ?? 0),
      monthlyAmountY2: Number(o.monthlyAmountY2 ?? 0),
    };
  });
}

export function ledgerToRow(item: DreGranularItem): LedgerLineRow {
  return {
    id: item.id,
    section: item.section,
    item_type: item.type,
    category: item.category,
    name: item.name,
    monthly_amount_y1: item.monthlyAmountY1,
    monthly_amount_y2: item.monthlyAmountY2,
    active: item.active,
    is_percentage_of_revenue: Boolean(item.isPercentageOfRevenue),
    percentage_value: item.percentageValue ?? null,
    account_code: item.accountCode ?? null,
    cost_center_id: item.costCenterId ?? null,
    cost_behavior: item.costBehavior ?? null,
    engine_locked: Boolean(item.engineLocked),
    manual_override: Boolean(item.manualOverride),
    is_fator_r_numerator: Boolean(item.isFatorRNumerator),
    is_fator_r_excluded: Boolean(item.isFatorRExcluded),
    composition: item.composition ?? [],
    notes: item.notes ?? '',
  };
}

export function rowToLedger(r: LedgerLineRow): DreGranularItem {
  const composition = parseComposition(r.composition);
  const behaviorErr = costBehaviorValidationError(r.cost_behavior);
  if (behaviorErr) throw new Error(behaviorErr);
  return {
    id: r.id,
    section: r.section as DreSection,
    type: r.item_type as DreItemType,
    category: r.category,
    name: r.name,
    monthlyAmountY1: Number(r.monthly_amount_y1),
    monthlyAmountY2: Number(r.monthly_amount_y2),
    active: Boolean(r.active),
    ...(r.is_percentage_of_revenue ? { isPercentageOfRevenue: true } : {}),
    ...(r.percentage_value != null ? { percentageValue: Number(r.percentage_value) } : {}),
    ...(r.account_code ? { accountCode: r.account_code } : {}),
    ...(r.cost_center_id ? { costCenterId: r.cost_center_id } : {}),
    ...(r.cost_behavior ? { costBehavior: r.cost_behavior as CostBehavior } : {}),
    ...(r.engine_locked ? { engineLocked: true } : {}),
    ...(r.manual_override ? { manualOverride: true } : {}),
    ...(r.is_fator_r_numerator ? { isFatorRNumerator: true } : {}),
    ...(r.is_fator_r_excluded ? { isFatorRExcluded: true } : {}),
    ...(composition ? { composition } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
  };
}

/** Pure helpers for catalog tests / seed decisions. */
export function needsSeed(counts: { accounts: number; costCenters: number; ledger: number }): {
  accounts: boolean;
  costCenters: boolean;
  ledger: boolean;
} {
  return {
    accounts: counts.accounts <= 0,
    costCenters: counts.costCenters <= 0,
    ledger: counts.ledger <= 0,
  };
}

export function accountInUse(ledgerAccountCodes: Array<string | null | undefined>, code: string): boolean {
  return ledgerAccountCodes.some((c) => c === code);
}
