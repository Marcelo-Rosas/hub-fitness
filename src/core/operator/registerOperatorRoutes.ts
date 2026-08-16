import type { Express } from 'express';
import { listContracts, listPriceCategoryItems } from './operatorCatalog';
import { resolvePriceFloors, type FloorFallback } from './resolvePriceFloors';

const DEFAULT_FALLBACK: FloorFallback = {
  storage: 22.5,
  handling: 25,
  deunitization: 1400,
  labeling: 0.75,
  adValoremPct: 0.001,
};

export function registerOperatorRoutes(app: Express): void {
  app.get('/api/operator/price-floors', async (req, res) => {
    const q = req.query;
    const fallback: FloorFallback = {
      storage: q.storage != null ? Number(q.storage) : DEFAULT_FALLBACK.storage,
      handling: q.handling != null ? Number(q.handling) : DEFAULT_FALLBACK.handling,
      deunitization: q.deunitization != null ? Number(q.deunitization) : DEFAULT_FALLBACK.deunitization,
      labeling: q.labeling != null ? Number(q.labeling) : DEFAULT_FALLBACK.labeling,
      adValoremPct: q.adValoremPct != null ? Number(q.adValoremPct) : DEFAULT_FALLBACK.adValoremPct,
    };
    const items = await listPriceCategoryItems();
    const floors = resolvePriceFloors(items, fallback);
    return res.json({
      success: true,
      itemsCount: items.length,
      floors,
    });
  });

  app.get('/api/operator/contracts', async (_req, res) => {
    const contracts = await listContracts();
    return res.json({
      success: true,
      contracts,
      empty: contracts.length === 0,
    });
  });
}
