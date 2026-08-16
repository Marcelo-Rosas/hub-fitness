/** Gaps de dossiê RFQ — regras canônicas (Plan B / M19). */

export type OpsRealFlags = {
  ops_real_started: boolean;
  ops_real_started_at: string | null;
};

export type DossierGap =
  | 'preço unitário'
  | 'landed mensal'
  | 'prazo de entrega'
  | 'volume operacional';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Volume operacional só entra no gap a partir do 3º mês após ops_real_started_at. */
export function isVolumeEvaluationActive(
  flags: OpsRealFlags,
  now: Date = new Date(),
): boolean {
  if (!flags.ops_real_started || !flags.ops_real_started_at) return false;
  const started = Date.parse(flags.ops_real_started_at);
  if (!Number.isFinite(started)) return false;
  // 3º mês ≈ started + 2 meses calendário (~60d) — spec: agora >= started + 2 meses
  const twoMonthsMs = 62 * MS_PER_DAY;
  return now.getTime() >= started + twoMonthsMs;
}

export function dossierGaps(
  payload: Record<string, unknown>,
  flags: OpsRealFlags,
  now: Date = new Date(),
): DossierGap[] {
  const gaps: DossierGap[] = [];
  const unit = num(payload.unit_price ?? payload.unit_price_brl);
  const landed = num(payload.landed_monthly ?? payload.landed_cost_monthly_brl);
  const leadRaw = payload.lead_time_days ?? payload.delivery_lead_time_days;
  const leadOk =
    leadRaw != null && Number.isFinite(Number(leadRaw)) && Number(leadRaw) > 0;
  const volume = payload.volume != null ? String(payload.volume) : '';

  if (unit == null || unit <= 0) gaps.push('preço unitário');
  if (landed == null || landed <= 0) gaps.push('landed mensal');
  if (!leadOk) gaps.push('prazo de entrega');

  if (isVolumeEvaluationActive(flags, now)) {
    if (!volume.trim() || /(?:^|\s)1\s*un/i.test(volume)) {
      gaps.push('volume operacional');
    }
  }

  return gaps;
}

/** Bloqueia APPROVE sem preço/landed positivos. */
export function missingCommercialForApprove(
  payload: Record<string, unknown>,
): boolean {
  const unit = num(payload.unit_price ?? payload.unit_price_brl);
  const landed = num(payload.landed_monthly ?? payload.landed_cost_monthly_brl);
  return unit == null || unit <= 0 || landed == null || landed <= 0;
}

/** Score heurístico explícito — NÃO é confiança de modelo. */
export function heuristicQuoteScore(input: {
  isWinner: boolean;
  supplierUf: string;
}): { score: number; label: string } {
  if (input.isWinner) {
    return { score: 92, label: 'heurística: vencedor matriz' };
  }
  if (input.supplierUf.toUpperCase() === 'SC') {
    return { score: 86, label: 'heurística: UF SC' };
  }
  return { score: 80, label: 'heurística: demais UF' };
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
