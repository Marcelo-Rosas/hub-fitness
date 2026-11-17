/**
 * Integra Comex (SERPRO) — consulta pública gratuita "data da última atualização".
 *
 * Sem autenticação. A API diz só QUANDO o documento mudou, não O QUÊ. Não valida
 * números: devolve só os que encontrou. dataAtualizacao vem sem fuso (tratamos
 * como horário de Brasília). Endpoints verificados ao vivo em 2026-11-17.
 *
 * Módulo puro (sem Node/DOM): também é importado pelo front para os avisos de formato.
 */

export type TrackingKind = 'ce' | 'di' | 'li' | 'duimp';

export const TRACKING_KINDS: readonly TrackingKind[] = ['ce', 'di', 'li', 'duimp'];

export const TRACKING_KIND_LABEL: Record<TrackingKind, string> = {
  ce: 'CE-Mercante',
  di: 'DI',
  li: 'LI',
  duimp: 'DUIMP',
};

export const INTEGRA_ENDPOINTS: Record<TrackingKind, { url: string; param: 'nr' | 'duimp'; batch: number }> = {
  ce: {
    url: 'https://siscomex-carga.estaleiro.serpro.gov.br/siscarga-api/ce/data-ultima-atualizacao',
    param: 'nr',
    batch: 50,
  },
  di: {
    url: 'https://siscomex-di.estaleiro.serpro.gov.br/siscomex-di-api/declaracoes-importacao/data-ultima-atualizacao',
    param: 'nr',
    batch: 50,
  },
  // O swagger diz basePath /li-consulta-atualizacao, mas o caminho que responde é este.
  li: {
    url: 'https://siscomex-li.estaleiro.serpro.gov.br/siscomex-li-api/licencas-importacao/data-ultima-atualizacao',
    param: 'nr',
    batch: 50,
  },
  duimp: {
    url: 'https://pro-integra-pub-pucomex-dimp.estaleiro.serpro.gov.br/duimp-integracomex-pub/api/duimp/atualizacao',
    param: 'duimp',
    batch: 100,
  },
};

export const MERCANTE_URL = 'https://www.mercante.transportes.gov.br/';
export const PORTAL_UNICO_URL = 'https://portalunico.siscomex.gov.br/';

const DIGITS_LEN: Record<Exclude<TrackingKind, 'duimp'>, number> = { ce: 15, di: 10, li: 10 };
const DUIMP_RE = /^\d{2}BR\d{11}$/;

/** Limpa o número: só dígitos (CE/DI/LI) ou maiúsculas sem separadores (DUIMP). */
export function normalizeDocNumber(kind: TrackingKind, raw: unknown): string {
  const s = String(raw ?? '');
  if (kind === 'duimp') return s.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return s.replace(/\D/g, '');
}

export function isValidDocNumber(kind: TrackingKind, normalized: string): boolean {
  if (kind === 'duimp') return DUIMP_RE.test(normalized);
  return /^\d+$/.test(normalized) && normalized.length === DIGITS_LEN[kind];
}

/** LIs separadas por vírgula (ou ponto e vírgula/quebra de linha), normalizadas, sem repetidos. */
export function parseLiList(raw: unknown): string[] {
  const out: string[] = [];
  for (const part of String(raw ?? '').split(/[,;\n]+/)) {
    const n = normalizeDocNumber('li', part);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Aviso de formato para o formulário (não bloqueia o salvamento). null = ok ou vazio. */
export function formatWarning(kind: TrackingKind, raw: unknown): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  if (kind === 'li') {
    const bad = parseLiList(raw).filter((n) => !isValidDocNumber('li', n));
    return bad.length ? `LI deve ter 10 dígitos — confira: ${bad.join(', ')}` : null;
  }
  const n = normalizeDocNumber(kind, raw);
  if (isValidDocNumber(kind, n)) return null;
  if (kind === 'ce') return 'CE-Mercante deve ter 15 dígitos — pedir ao agente de carga ou ver no Mercante.';
  if (kind === 'di') return 'DI deve ter 10 dígitos (ex.: 25/1234567-8).';
  return 'DUIMP deve seguir o padrão 25BR00000000000 (2 dígitos, BR, 11 dígitos) — não será acompanhada.';
}

export interface TrackingDocRef {
  kind: TrackingKind;
  number: string;
}

/**
 * Números do processo que viram linhas de acompanhamento. Só entram os de formato válido
 * (o formulário avisa os inválidos). DUIMP = declaration_number quando importação.
 */
export function trackingDocsFromPayload(payload: Record<string, unknown> | null | undefined): TrackingDocRef[] {
  const p = payload || {};
  const docs: TrackingDocRef[] = [];
  const push = (kind: TrackingKind, number: string) => {
    if (isValidDocNumber(kind, number) && !docs.some((d) => d.kind === kind && d.number === number)) {
      docs.push({ kind, number });
    }
  };
  push('ce', normalizeDocNumber('ce', p.ce_mercante_number));
  push('di', normalizeDocNumber('di', p.di_number));
  for (const li of parseLiList(p.li_numbers)) push('li', li);
  const type = String(p.type || 'importacao');
  if (type === 'importacao') push('duimp', normalizeDocNumber('duimp', p.declaration_number));
  return docs;
}

/** Erro conhecido do módulo — mensagem pt-BR segura para mostrar ao operador. */
export class IntegraComexError extends Error {
  readonly code = 'INTEGRA_COMEX_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'IntegraComexError';
  }
}

export interface LastUpdate {
  /** dataAtualizacao como veio (sem fuso; horário de Brasília). */
  updatedAt: string;
  /** versaoVigente (só DUIMP). */
  version: number | null;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function fetchBatch(
  kind: TrackingKind,
  numbers: string[],
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<Array<Record<string, unknown>>> {
  const ep = INTEGRA_ENDPOINTS[kind];
  const qs = numbers.map((n) => `${ep.param}=${encodeURIComponent(n)}`).join('&');
  const label = TRACKING_KIND_LABEL[kind];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(`${ep.url}?${qs}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
      throw new IntegraComexError(`Siscomex não respondeu a tempo ao consultar ${label}.`);
    }
    throw new IntegraComexError(`Falha de rede ao consultar ${label} no Siscomex.`);
  } finally {
    clearTimeout(timer);
  }

  const notFoundIsEmpty = kind === 'li' || kind === 'duimp';
  if (res.status === 404 && notFoundIsEmpty) return [];
  if (!res.ok) throw new IntegraComexError(`Siscomex respondeu HTTP ${res.status} ao consultar ${label}.`);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new IntegraComexError(`Siscomex devolveu resposta inválida ao consultar ${label}.`);
  }
  if (kind === 'duimp') {
    const list = (json as { multiStatus?: unknown } | null)?.multiStatus;
    return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
  }
  if (!Array.isArray(json)) throw new IntegraComexError(`Siscomex devolveu formato inesperado ao consultar ${label}.`);
  return json as Array<Record<string, unknown>>;
}

/**
 * Data da última atualização de cada número encontrado (lotes de 50; DUIMP 100).
 * Sequencial e sem nova tentativa: o SERPRO pede uso racional.
 */
export async function fetchLastUpdates(
  kind: TrackingKind,
  numbers: string[],
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<Map<string, LastUpdate>> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const unique = [...new Set(numbers.map((n) => normalizeDocNumber(kind, n)).filter(Boolean))];
  const out = new Map<string, LastUpdate>();
  for (const batch of chunk(unique, INTEGRA_ENDPOINTS[kind].batch)) {
    for (const item of await fetchBatch(kind, batch, doFetch, timeoutMs)) {
      const numero = normalizeDocNumber(kind, item.numero);
      const updatedAt = typeof item.dataAtualizacao === 'string' ? item.dataAtualizacao.trim() : '';
      if (!numero || !updatedAt) continue;
      const v = Number(item.versaoVigente);
      out.set(numero, { updatedAt, version: kind === 'duimp' && Number.isFinite(v) && v > 0 ? v : null });
    }
  }
  return out;
}
