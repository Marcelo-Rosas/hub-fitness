import type { Express } from 'express';
import {
  listContracts,
  listPriceCategoryItems,
  operatorConnectionProbe,
} from './operatorCatalog';
import { resolvePriceFloors, type FloorFallback } from './resolvePriceFloors';
import {
  deleteScenarioDef,
  listScenarioDefs,
  rowToScenario,
  scenarioCatalogProbe,
  upsertScenarioDef,
} from './scenarioCatalog';
import { scenarioDriversValidationError } from '../scenarioDrivers';

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
      operator: operatorConnectionProbe(),
    });
  });

  app.get('/api/operator/contracts', async (_req, res) => {
    const contracts = await listContracts();
    return res.json({
      success: true,
      contracts,
      empty: contracts.length === 0,
      operator: operatorConnectionProbe(),
    });
  });

  app.get('/api/operator/scenarios', async (_req, res) => {
    const rows = await listScenarioDefs();
    return res.json({
      success: true,
      scenarios: rows.map(rowToScenario),
      empty: rows.length === 0,
      operator: { ...operatorConnectionProbe(), scenarios: scenarioCatalogProbe() },
    });
  });

  app.post('/api/operator/scenarios', async (req, res) => {
    const body = req.body ?? {};
    const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `sc-${Date.now()}`;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Novo cenário';
    const driversErr = scenarioDriversValidationError(body.drivers);
    if (driversErr) return res.status(400).json({ success: false, error: driversErr });
    const result = await upsertScenarioDef({
      id,
      name,
      isBaseline: false,
      status: body.status === 'warning' || body.status === 'critical' ? body.status : 'ok',
      drivers: body.drivers,
      notes: body.notes ?? null,
      mitigationStrategy: body.mitigationStrategy ?? null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 99,
    });
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true, id });
  });

  app.put('/api/operator/scenarios/:id', async (req, res) => {
    const id = req.params.id;
    const body = req.body ?? {};
    const driversErr = scenarioDriversValidationError(body.drivers);
    if (driversErr) return res.status(400).json({ success: false, error: driversErr });
    const result = await upsertScenarioDef({
      id,
      name: typeof body.name === 'string' ? body.name : id,
      isBaseline: Boolean(body.isBaseline),
      status: body.status === 'warning' || body.status === 'critical' ? body.status : 'ok',
      drivers: body.drivers,
      notes: body.notes ?? null,
      mitigationStrategy: body.mitigationStrategy ?? null,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
    });
    if (result.ok === false) {
      const code = result.error.includes('fora') || result.error.includes('inválido') ? 400 : 500;
      return res.status(code).json({ success: false, error: result.error });
    }
    return res.json({ success: true, id });
  });

  app.delete('/api/operator/scenarios/:id', async (req, res) => {
    const result = await deleteScenarioDef(req.params.id);
    if (result.ok === false) {
      const code = result.error.includes('baseline') ? 403 : 400;
      return res.status(code).json({ success: false, error: result.error });
    }
    return res.json({ success: true });
  });
}
