/**
 * Acompanhamento Siscomex (Integra Comex · consulta pública gratuita).
 *
 * Os números do processo (CE, DI, LIs, DUIMP) viram linhas em comex_tracking;
 * o verificador pergunta ao SERPRO a data da última atualização e marca
 * "Alterado" quando ela muda. Só importa tipos do store (sem ciclo em runtime).
 */

import type { ComexTrackingRecord } from '../../types/comex';
import type { ComexStore } from './comexStore';
import { trackingDocsFromPayload } from './integraComexPublic';

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
