/**
 * Normalização/validação PURA do cadastro de clientes Comex.
 * Sem imports node:* — o front React importa defaultRadarLimit daqui.
 */
import type {
  ComexClientInput,
  ComexEnumOption,
  ComexFieldDef,
  ComexFieldDefInput,
  ComexRadarModality,
  ComexRepStatus,
} from '../../types/comex';

const MODALITIES: ComexRadarModality[] = ['expressa', 'limitada_50k', 'limitada_150k', 'ilimitada'];
const REP_STATUSES: ComexRepStatus[] = ['pendente', 'ativa', 'vencida', 'revogada'];

/**
 * Valores de enum que o código usa (cálculo do Radar, aviso de DI, CHECKs das
 * tabelas). Pelo painel Campos só rótulo e ordem mudam — o conjunto não.
 */
export const LOCKED_ENUM_VALUES: Record<string, Record<string, string[]>> = {
  client: { radar_modality: [...MODALITIES], rep_status: [...REP_STATUSES] },
};

/** Colunas editáveis das tabelas comex_clients/comex_brokers (campos de sistema). */
export const REGISTRY_COLUMNS: Record<'client' | 'broker', readonly string[]> = {
  client: [
    'cnpj_root',
    'cnpj',
    'legal_name',
    'trade_name',
    'radar_status',
    'radar_modality',
    'radar_limit_usd',
    'radar_operations',
    'radar_legal_basis',
    'radar_checked_at',
    'rep_status',
    'rep_certificate',
    'rep_role_type',
    'rep_valid_from',
    'rep_valid_to',
    'broker_id',
    'notes',
  ],
  broker: ['name', 'cpf', 'rfb_registry', 'email', 'phone', 'active'],
};

/** Campos que o backend exige no cadastro: não podem ficar ocultos nem opcionais. */
export const REQUIRED_SYSTEM_FIELDS: Record<'client' | 'broker', readonly string[]> = {
  client: ['cnpj_root', 'legal_name'],
  broker: ['name'],
};

export function isRequiredSystemField(entity: unknown, fieldKey: unknown): boolean {
  return isRegistryEntity(entity) && REQUIRED_SYSTEM_FIELDS[entity].includes(String(fieldKey));
}

export function isRegistryEntity(entity: unknown): entity is 'client' | 'broker' {
  return entity === 'client' || entity === 'broker';
}

/** Campo de sistema = def client/broker cujo field_key é coluna da tabela. */
export function isSystemField(entity: unknown, fieldKey: unknown): boolean {
  return isRegistryEntity(entity) && REGISTRY_COLUMNS[entity].includes(String(fieldKey));
}

export function isLockedField(entity: unknown, fieldKey: unknown): boolean {
  return Boolean(LOCKED_ENUM_VALUES[String(entity)]?.[String(fieldKey)]);
}

/**
 * Recusa mudança no conjunto de valores (ou no tipo) de um campo travado.
 * Rótulo e ordem das opções podem mudar.
 */
export function lockedOptionsError(
  def: Pick<ComexFieldDefInput, 'entity' | 'field_key' | 'data_type'> & {
    enum_options?: ComexEnumOption[];
    label?: string;
  },
): string | null {
  const locked = LOCKED_ENUM_VALUES[def.entity]?.[def.field_key];
  if (!locked) return null;
  const msg = `Os valores de "${def.label || def.field_key}" são usados pelo cálculo do Radar — só rótulo e ordem podem mudar (${locked.join(', ')})`;
  if (def.data_type !== 'enum') return msg;
  const values = (def.enum_options || []).map((o) => String(o.value));
  const same = values.length === locked.length && new Set(values).size === locked.length && locked.every((v) => values.includes(v));
  return same ? null : msg;
}

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/**
 * Valida um registro (cliente/despachante) contra o metadado: obrigatórios
 * presentes e enum fechado (data_type 'enum') com valor dentro das opções.
 * Lista aberta (widget select + data_type text) aceita valor novo; widget
 * 'broker' tem opções dinâmicas e é ignorado. No update, `existing` (registro
 * gravado) libera valor antigo que não mudou mesmo fora das opções atuais.
 */
export function validateRecordAgainstDefs(
  input: Record<string, unknown>,
  defs: ComexFieldDef[],
  existing?: Record<string, unknown> | null,
): string | null {
  for (const def of defs) {
    if (def.widget === 'broker') continue;
    const value = input[def.field_key];
    if (isEmptyValue(value)) {
      if (def.required) return `Campo obrigatório: ${def.label}`;
      continue;
    }
    if (def.data_type === 'enum' && (def.enum_options || []).length > 0) {
      const v = String(value).trim();
      const stored = existing?.[def.field_key];
      if (stored !== undefined && stored !== null && String(stored).trim() === v) continue;
      if (!def.enum_options.some((o) => String(o.value) === v)) {
        return `Valor inválido para ${def.label}: ${v}`;
      }
    }
  }
  return null;
}

/** Norma que rege a habilitação no Radar (como aparece em "Base Legal" na tela da Receita). */
export const RADAR_LEGAL_BASIS_IN_1984 = 'Instrução Normativa RFB nº 1.984, de 27 de outubro de 2020';

/**
 * Base legal sugerida pela modalidade. Hoje todas as modalidades (Expressa, Limitadas,
 * Ilimitada) seguem a IN RFB 1.984/2020 — mudou a norma, muda só aqui.
 */
export function defaultRadarLegalBasis(m: ComexRadarModality | null | undefined): string | null {
  return m ? RADAR_LEGAL_BASIS_IN_1984 : null;
}

/**
 * Teto padrão por modalidade (US$/6 meses). Expressa e Ilimitada = sem teto:
 * pela IN RFB 1.984/2020 a Expressa é de S.A. aberta, empresa pública e
 * sociedade de economia mista, sem limite de operação (orientação da Receita).
 */
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

/**
 * Aviso de rota da declaração: a Receita lista "Radar Limitado" como
 * impossibilidade de DUIMP (cronograma de desligamento da DI) e a elaboração
 * da DUIMP exige habilitação "diferente de limitada".
 */
export function declarationRouteNote(m: ComexRadarModality | null | undefined): string | null {
  if (m !== 'limitada_50k' && m !== 'limitada_150k') return null;
  return 'Radar Limitado: a Receita lista como impossibilidade de DUIMP — a importação segue por DI. Confirmar com o despachante (cronograma de desligamento da DI).';
}

/** true só para data real no formato AAAA-MM-DD (rejeita 2026-02-30). */
export function isValidYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília — não vira o dia seguinte após 21h. */
export function todayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function dateOrNull(v: unknown, invalidMsg: string): string | null {
  const s = textOrNull(v);
  if (s === null) return null;
  if (!isValidYmd(s)) throw new Error(`${invalidMsg}: use AAAA-MM-DD`);
  return s;
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
    radar_checked_at: dateOrNull(input.radar_checked_at, 'Data de conferência do Radar inválida'),
    rep_status,
    rep_certificate: textOrNull(input.rep_certificate),
    rep_role_type: textOrNull(input.rep_role_type),
    rep_valid_from: dateOrNull(input.rep_valid_from, 'Início da representação inválido'),
    rep_valid_to: dateOrNull(input.rep_valid_to, 'Fim da representação inválido'),
    broker_id: textOrNull(input.broker_id),
    notes: textOrNull(input.notes),
  };
}
