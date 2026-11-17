/**
 * Rotas do acompanhamento Siscomex (Integra Comex · consulta pública gratuita).
 * Registradas de dentro de registerPucomexRoutes, depois do comexGateway:
 * exigem x-comex-token (não estão em COMEX_PUBLIC_ROUTES).
 */

import type { Express, Response } from 'express';
import type { ComexTrackingRecord } from '../../types/comex';
import { getComexStore } from './comexStore';
import {
  runTrackingCheck,
  summarizeTracking,
  trackingSchedulerInfo,
  trackingStatus,
  type TrackingStatus,
} from './comexTracking';
import { comexErrorStatus, sendError } from './registerComexClientRoutes';

/** "Verificar agora": no máximo 1 por processo a cada 5 min (uso racional do SERPRO). */
const CHECK_COOLDOWN_MS = 5 * 60 * 1000;
const lastManualCheck = new Map<string, number>();

export function resetTrackingCheckRateLimit(): void {
  lastManualCheck.clear();
}

function takeCheckSlot(key: string, now: number): number {
  for (const [k, t] of lastManualCheck) if (now - t >= CHECK_COOLDOWN_MS) lastManualCheck.delete(k);
  const last = lastManualCheck.get(key);
  if (last !== undefined) return CHECK_COOLDOWN_MS - (now - last);
  lastManualCheck.set(key, now);
  return 0;
}

export type TrackingRowView = ComexTrackingRecord & { status: TrackingStatus };

function withStatus(rows: ComexTrackingRecord[], now = new Date()): TrackingRowView[] {
  return rows.map((r) => ({ ...r, status: trackingStatus(r, now) }));
}

function fail(res: Response, err: unknown) {
  const { status, message } = comexErrorStatus(err);
  return sendError(res, status, message);
}

export function registerComexTrackingRoutes(
  app: Express,
  opts: { fetchImpl?: typeof fetch } = {},
): void {
  app.get('/api/comex/tracking/summary', async (_req, res) => {
    try {
      const store = await getComexStore();
      res.json({ success: true, data: summarizeTracking(await store.listTracking()), scheduler: trackingSchedulerInfo() });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get('/api/comex/tracking', async (req, res) => {
    try {
      const processId = typeof req.query.process_id === 'string' ? req.query.process_id.trim() : '';
      if (!processId) return sendError(res, 400, 'Informe process_id');
      const store = await getComexStore();
      res.json({
        success: true,
        data: withStatus(await store.listTracking(processId)),
        scheduler: trackingSchedulerInfo(),
      });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/comex/tracking/check', async (req, res) => {
    try {
      const processId = typeof req.body?.process_id === 'string' ? req.body.process_id.trim() : '';
      const wait = takeCheckSlot(processId || '*', Date.now());
      if (wait > 0) {
        const min = Math.max(1, Math.ceil(wait / 60_000));
        return sendError(
          res,
          429,
          `Aguarde ${min} min para verificar de novo — o Siscomex pede uso racional (1 verificação por processo a cada 5 min).`,
        );
      }
      const store = await getComexStore();
      if (processId && !(await store.getProcess(processId))) {
        lastManualCheck.delete(processId);
        return sendError(res, 404, 'Processo não encontrado');
      }
      const result = await runTrackingCheck({
        store,
        fetchImpl: opts.fetchImpl,
        processId: processId || undefined,
      });
      if (!result.ran) {
        lastManualCheck.delete(processId || '*');
        return sendError(res, 409, 'Já há uma verificação em andamento — tente de novo em instantes.');
      }
      res.json({
        success: true,
        data: withStatus(await store.listTracking(processId || undefined)),
        result,
        scheduler: trackingSchedulerInfo(),
      });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post('/api/comex/tracking/:id/seen', async (req, res) => {
    try {
      const store = await getComexStore();
      const row = await store.updateTracking(req.params.id, { seen_at: new Date().toISOString() });
      if (!row) return sendError(res, 404, 'Acompanhamento não encontrado');
      res.json({ success: true, data: withStatus([row])[0] });
    } catch (err) {
      fail(res, err);
    }
  });
}
