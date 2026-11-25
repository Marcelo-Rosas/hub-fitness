/**
 * Rotas de estatísticas de mercado (ComexStat/MDIC — dado público).
 * Registradas de dentro de registerPucomexRoutes, depois do comexGateway.
 * POST /api/comex/stats/monthly está em COMEX_PUBLIC_ROUTES (sem token),
 * com cota própria de 30 chamadas reais ao ComexStat/min (cache não conta).
 */

import type { Express } from 'express';
import { ComexStatError } from './comexStatBenchmark';
import {
  ComexStatRateLimitError,
  fetchNcmMonthlySeries,
  seriesTrend,
  type SeriesMonths,
} from './comexStatMonthly';
import { ISO2_TO_SISCOMEX, parseCountryIso2 } from './comexTreatments';
import { sendError } from './registerComexClientRoutes';

export function registerComexStatsRoutes(app: Express, opts: { fetchImpl?: typeof fetch } = {}): void {
  app.post('/api/comex/stats/monthly', async (req, res) => {
    try {
      const ncm = String(req.body?.ncmCode || '').replace(/\D/g, '');
      if (ncm.length !== 8) return sendError(res, 400, 'ncmCode deve ter 8 dígitos');
      const rawMonths = req.body?.months;
      const months = rawMonths == null || rawMonths === '' ? 12 : Number(rawMonths);
      if (months !== 12 && months !== 24) return sendError(res, 400, 'months deve ser 12 ou 24');
      const iso2 = parseCountryIso2(String(req.body?.country || ''));
      const countryCode = iso2 ? (ISO2_TO_SISCOMEX[iso2] ?? null) : null;
      const series = await fetchNcmMonthlySeries({
        ncm,
        countryCode,
        months: months as SeriesMonths,
        fetchImpl: opts.fetchImpl,
      });
      return res.json({ success: true, data: { series, trend: seriesTrend(series.months) } });
    } catch (err: unknown) {
      // Rota pública: só mensagens próprias do módulo saem; o resto fica no log do servidor.
      if (err instanceof ComexStatRateLimitError) return sendError(res, 429, err.message);
      if (err instanceof ComexStatError) return sendError(res, 502, err.message);
      console.error('[comex/stats/monthly] falha inesperada:', err);
      return sendError(res, 502, 'Falha ao consultar o ComexStat — tente de novo em instantes.');
    }
  });
}
