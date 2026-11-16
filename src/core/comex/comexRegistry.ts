/**
 * Normalização/validação PURA do cadastro de clientes Comex.
 * Sem imports node:* — o front React importa defaultRadarLimit daqui.
 */
import type { ComexClientInput, ComexRadarModality, ComexRepStatus } from '../../types/comex';

const MODALITIES: ComexRadarModality[] = ['expressa', 'limitada_50k', 'limitada_150k', 'ilimitada'];
const REP_STATUSES: ComexRepStatus[] = ['pendente', 'ativa', 'vencida', 'revogada'];

export function defaultRadarLimit(m: ComexRadarModality | null | undefined): number | null {
  if (m === 'limitada_50k') return 50000;
  if (m === 'limitada_150k') return 150000;
  return null;
}

export function slugify(legalName: string): string {
  const s = String(legalName || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'cliente';
}

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function textOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function normalizeClientInput(input: ComexClientInput): ComexClientInput {
  const cnpj_root = digits(input.cnpj_root);
  if (cnpj_root.length !== 8) throw new Error('CNPJ raiz deve ter 8 dígitos');

  let cnpj: string | null = null;
  const rawCnpj = digits(input.cnpj);
  if (rawCnpj) {
    if (rawCnpj.length !== 14) throw new Error('CNPJ completo deve ter 14 dígitos');
    if (!rawCnpj.startsWith(cnpj_root)) throw new Error('CNPJ completo não corresponde ao CNPJ raiz informado');
    cnpj = rawCnpj;
  }

  const legal_name = String(input.legal_name ?? '').trim();
  if (!legal_name) throw new Error('Razão social é obrigatória');

  const radar_modality = (textOrNull(input.radar_modality) as ComexRadarModality | null) ?? null;
  if (radar_modality && !MODALITIES.includes(radar_modality)) {
    throw new Error(`Modalidade do Radar inválida: ${radar_modality}`);
  }

  const rep_status = ((textOrNull(input.rep_status) as ComexRepStatus | null) ?? 'pendente') as ComexRepStatus;
  if (!REP_STATUSES.includes(rep_status)) throw new Error(`Status da representação inválido: ${rep_status}`);

  let radar_limit_usd: number | null = null;
  if (input.radar_limit_usd !== undefined && input.radar_limit_usd !== null && String(input.radar_limit_usd) !== '') {
    const n = Number(input.radar_limit_usd);
    if (!Number.isFinite(n) || n < 0) throw new Error('Limite do Radar inválido');
    radar_limit_usd = n;
  } else {
    radar_limit_usd = defaultRadarLimit(radar_modality);
  }

  return {
    id: input.id,
    cnpj_root,
    cnpj,
    legal_name,
    trade_name: textOrNull(input.trade_name),
    radar_status: textOrNull(input.radar_status),
    radar_modality,
    radar_limit_usd,
    radar_operations: textOrNull(input.radar_operations),
    radar_legal_basis: textOrNull(input.radar_legal_basis),
    radar_checked_at: textOrNull(input.radar_checked_at),
    rep_status,
    rep_certificate: textOrNull(input.rep_certificate),
    rep_role_type: textOrNull(input.rep_role_type),
    rep_valid_from: textOrNull(input.rep_valid_from),
    rep_valid_to: textOrNull(input.rep_valid_to),
    broker_id: textOrNull(input.broker_id),
    notes: textOrNull(input.notes),
  };
}
