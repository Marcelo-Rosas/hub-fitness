/**
 * Acompanhamento Siscomex (Integra Comex · consulta pública gratuita).
 *
 * Os números do processo (CE, DI, LIs, DUIMP) viram linhas em comex_tracking;
 * o verificador pergunta ao SERPRO a data da última atualização e marca
 * "Alterado" quando ela muda. Só importa tipos do store (sem ciclo em runtime).
 */

import type { ComexTrackingKind, ComexTrackingPatch, ComexTrackingRecord } from '../../types/comex';
import type { ComexStore } from './comexStore';
import {
  fetchLastUpdates,
  IntegraComexError,
  TRACKING_KIND_LABEL,
  TRACKING_KINDS,
  trackingDocsFromPayload,
} from './integraComexPublic';

/** Processos com estes status não são mais consultados. */
export const INACTIVE_PROCESS_STATUSES: readonly string[] = ['desembaracado', 'cancelado'];
/** Primeira aparição destes tipos é sinal útil (CE registrado, DUIMP registrada). */
const FIRST_SEEN_IS_CHANGE: readonly ComexTrackingKind[] = ['ce', 'duimp'];
export const NOT_FOUND_AFTER_MS = 7 * 24 * 3600 * 1000;
export const TRACKING_INTERVAL_MS = 30 * 60 * 1000;
const TZ = 'America/Sao_Paulo';

export type TrackingStatus = 'alterado' | 'erro' | 'nao_encontrado' | 'aguardando' | 'sem_mudanca';

export const NOT_FOUND_MESSAGE = 'Número não encontrado no Siscomex — confira se está correto.';

/** "Alterado" = changed_at IS NOT NULL AND (seen_at IS NULL OR seen_at < changed_at). */
export function isTrackingChanged(row: Pick<ComexTrackingRecord, 'changed_at' | 'seen_at'>): boolean {
  if (!row.changed_at) return false;
  if (!row.seen_at) return true;
  return Date.parse(row.seen_at) < Date.parse(row.changed_at);
}

/**
 * Ao salvar o processo: números dos campos viram linhas (upsert) e as que saíram
 * são apagadas. Falha aqui avisa e segue — nunca quebra o salvamento do processo.
 */
export async function syncProcessTracking(
  store: Pick<ComexStore, 'syncTrackingDocs'>,
  processId: string,
  payload: Record<string, unknown> | null | undefined,
): Promise<void> {
  try {
    await store.syncTrackingDocs(processId, trackingDocsFromPayload(payload));
  } catch (err) {
    console.warn(
      `[comex] acompanhamento Siscomex não sincronizado para o processo ${processId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Situação de uma linha para a interface. */
export function trackingStatus(row: ComexTrackingRecord, now: Date = new Date()): TrackingStatus {
  if (isTrackingChanged(row)) return 'alterado';
  if (row.last_error) return 'erro';
  if (!row.found) {
    return now.getTime() - Date.parse(row.created_at) > NOT_FOUND_AFTER_MS ? 'nao_encontrado' : 'aguardando';
  }
  return 'sem_mudanca';
}

export interface TrackingProcessSummary {
  changed: number;
  notFound: number;
  errors: number;
  lastCheck: string | null;
  /** Para o selo (hover): o que mudou e não foi visto. */
  changes: Array<{ doc_kind: ComexTrackingKind; doc_number: string; changed_at: string }>;
}

export function summarizeTracking(
  rows: ComexTrackingRecord[],
  now: Date = new Date(),
): Record<string, TrackingProcessSummary> {
  const out: Record<string, TrackingProcessSummary> = {};
  for (const row of rows) {
    const s = (out[row.process_id] ??= { changed: 0, notFound: 0, errors: 0, lastCheck: null, changes: [] });
    const st = trackingStatus(row, now);
    if (st === 'alterado') {
      s.changed += 1;
      s.changes.push({ doc_kind: row.doc_kind, doc_number: row.doc_number, changed_at: row.changed_at! });
    } else if (st === 'nao_encontrado') s.notFound += 1;
    else if (st === 'erro') s.errors += 1;
    if (row.checked_at && (!s.lastCheck || row.checked_at > s.lastCheck)) s.lastCheck = row.checked_at;
  }
  return out;
}

// ---------------------------------------------------------------- janela

const windowFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Segunda a sexta, das 7h às 20h (America/Sao_Paulo). */
export function isInTrackingWindow(now: Date = new Date()): boolean {
  const parts = windowFmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return hour >= 7 && hour < 20;
}

/** Próxima rodada do agendador a partir da última (pula para o início da próxima janela). */
export function nextTrackingCheckAt(from: Date, intervalMs: number = TRACKING_INTERVAL_MS): Date {
  const candidate = new Date(from.getTime() + intervalMs);
  if (isInTrackingWindow(candidate)) return candidate;
  let t = Math.ceil(candidate.getTime() / 60_000) * 60_000;
  for (let i = 0; i < 4 * 24 * 60; i += 1, t += 60_000) {
    if (isInTrackingWindow(new Date(t))) return new Date(t);
  }
  return candidate;
}

// ---------------------------------------------------------------- verificação

export interface TrackingCheckResult {
  ran: boolean;
  reason?: 'em_andamento';
  /** Linhas consultadas. */
  checked: number;
  /** Linhas que passaram a "Alterado" nesta rodada. */
  changed: number;
  errors: string[];
}

let running = false;
let lastRunAt: string | null = null;

export function trackingLastRunAt(): string | null {
  return lastRunAt;
}

/** Só para testes. */
export function resetTrackingStateForTests(): void {
  running = false;
  lastRunAt = null;
}

async function selectRows(store: ComexStore, processId?: string): Promise<ComexTrackingRecord[]> {
  const rows = await store.listTracking(processId);
  if (!rows.length) return [];
  const procs = processId
    ? [await store.getProcess(processId)].filter((p) => p !== null)
    : await store.listProcesses();
  const active = new Set(
    procs.filter((p) => !INACTIVE_PROCESS_STATUSES.includes(String(p.payload?.status ?? ''))).map((p) => p.id),
  );
  return rows.filter((r) => active.has(r.process_id));
}

/**
 * Uma rodada: agrupa por tipo, uma consulta por lote, aplica as regras de mudança.
 * Trava em memória: no máximo uma rodada por vez. Sem nova tentativa imediata.
 */
export async function runTrackingCheck(opts: {
  store: ComexStore;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  processId?: string;
}): Promise<TrackingCheckResult> {
  if (running) return { ran: false, reason: 'em_andamento', checked: 0, changed: 0, errors: [] };
  running = true;
  try {
    const now = opts.now ?? (() => new Date());
    const rows = await selectRows(opts.store, opts.processId);
    const result: TrackingCheckResult = { ran: true, checked: rows.length, changed: 0, errors: [] };

    for (const kind of TRACKING_KINDS) {
      const ofKind = rows.filter((r) => r.doc_kind === kind);
      if (!ofKind.length) continue;
      let updates: Awaited<ReturnType<typeof fetchLastUpdates>>;
      try {
        updates = await fetchLastUpdates(
          kind,
          ofKind.map((r) => r.doc_number),
          { fetchImpl: opts.fetchImpl },
        );
      } catch (err) {
        const message =
          err instanceof IntegraComexError
            ? err.message
            : `Falha inesperada ao consultar ${TRACKING_KIND_LABEL[kind]} no Siscomex.`;
        result.errors.push(message);
        const ts = now().toISOString();
        for (const r of ofKind) await opts.store.updateTracking(r.id, { checked_at: ts, last_error: message });
        continue;
      }

      const ts = now().toISOString();
      for (const r of ofKind) {
        const hit = updates.get(r.doc_number);
        const patch: ComexTrackingPatch = { checked_at: ts, last_error: null };
        if (hit) {
          if (hit.version !== null) patch.version = hit.version;
          if (!r.found) {
            patch.found = true;
            patch.remote_updated_at = hit.updatedAt;
            if (FIRST_SEEN_IS_CHANGE.includes(kind)) patch.changed_at = ts;
          } else if (hit.updatedAt !== r.remote_updated_at) {
            patch.previous_remote_updated_at = r.remote_updated_at;
            patch.remote_updated_at = hit.updatedAt;
            patch.changed_at = ts;
          }
          if (patch.changed_at) result.changed += 1;
        }
        await opts.store.updateTracking(r.id, patch);
      }
    }
    lastRunAt = now().toISOString();
    return result;
  } finally {
    running = false;
  }
}

// ---------------------------------------------------------------- agendador

let schedulerIntervalMs: number | null = null;

/** Para a interface: agendador ligado? quando roda de novo? */
export function trackingSchedulerInfo(now: Date = new Date()): {
  enabled: boolean;
  lastRunAt: string | null;
  nextCheckAt: string | null;
} {
  if (schedulerIntervalMs === null) return { enabled: false, lastRunAt, nextCheckAt: null };
  const base = lastRunAt ? new Date(lastRunAt) : now;
  let next = nextTrackingCheckAt(base, schedulerIntervalMs);
  if (next.getTime() < now.getTime()) next = nextTrackingCheckAt(now, schedulerIntervalMs);
  return { enabled: true, lastRunAt, nextCheckAt: next.toISOString() };
}

/**
 * setInterval no container (padrão do startOutboxDispatcher), a cada 30 min, só na
 * janela seg–sex 7h–20h. Desligado com COMEX_TRACKING_DISABLED=1 e nunca em testes.
 * Devolve a função de parada, ou null quando não liga.
 */
export function startTrackingScheduler(opts: {
  getStore: () => Promise<ComexStore>;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  now?: () => Date;
  /** Só para os testes do próprio agendador. */
  allowInTests?: boolean;
}): (() => void) | null {
  if (process.env.COMEX_TRACKING_DISABLED === '1') return null;
  const inTests = !!process.env.VITEST || process.env.NODE_ENV === 'test';
  if (inTests && !opts.allowInTests) return null;
  const intervalMs = opts.intervalMs ?? TRACKING_INTERVAL_MS;
  const now = opts.now ?? (() => new Date());
  schedulerIntervalMs = intervalMs;
  const timer = setInterval(() => {
    if (!isInTrackingWindow(now())) return;
    void (async () => {
      const store = await opts.getStore();
      const r = await runTrackingCheck({ store, fetchImpl: opts.fetchImpl, now });
      if (r.errors.length) console.warn(`[comex tracking] ${r.errors.join(' | ')}`);
    })().catch((err) => {
      console.error('[comex tracking]', err instanceof Error ? err.message : err);
    });
  }, intervalMs);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    schedulerIntervalMs = null;
  };
}
