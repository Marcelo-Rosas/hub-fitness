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
import {
  deleteAccount,
  deleteCostCenter,
  deleteLedgerLine,
  financeCatalogProbe,
  listFinanceBundle,
  upsertAccount,
  upsertCostCenter,
  upsertLedgerLine,
} from './financeCatalog';
import { costBehaviorValidationError } from './financeMappers';
import { scenarioDriversValidationError } from '../scenarioDrivers';
import type { AccountItem, CostCenter } from '../../data/planoDeContasData';
import type { DreGranularItem } from '../../types';

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

  app.get('/api/operator/finance/bundle', async (_req, res) => {
    const bundle = await listFinanceBundle();
    if (!bundle) {
      return res.status(503).json({
        success: false,
        error: 'finance bundle indisponível',
        operator: { ...operatorConnectionProbe(), finance: financeCatalogProbe() },
      });
    }
    return res.json({
      success: true,
      accounts: bundle.accounts,
      costCenters: bundle.costCenters,
      ledger: bundle.ledger,
      operator: { ...operatorConnectionProbe(), finance: financeCatalogProbe() },
    });
  });

  app.post('/api/operator/finance/accounts', async (req, res) => {
    const body = req.body as AccountItem;
    if (!body?.code || !body?.name) {
      return res.status(400).json({ success: false, error: 'code e name obrigatórios' });
    }
    if (body.type === 'Analítica' || body.type === 'Sintética') {
      /* ok */
    } else {
      return res.status(400).json({ success: false, error: 'type deve ser Analítica ou Sintética' });
    }
    const result = await upsertAccount(body);
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true, code: body.code });
  });

  app.put('/api/operator/finance/accounts/:code', async (req, res) => {
    const code = req.params.code;
    const body = { ...(req.body as AccountItem), code };
    if (body.type && body.type !== 'Analítica' && body.type !== 'Sintética') {
      return res.status(400).json({ success: false, error: 'type deve ser Analítica ou Sintética' });
    }
    const result = await upsertAccount(body);
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true, code });
  });

  app.delete('/api/operator/finance/accounts/:code', async (req, res) => {
    const result = await deleteAccount(req.params.code);
    if (result.ok === false) {
      const status = result.status ?? 400;
      return res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
    return res.json({ success: true });
  });

  app.post('/api/operator/finance/cost-centers', async (req, res) => {
    const body = req.body as CostCenter;
    if (!body?.id || !body?.name) {
      return res.status(400).json({ success: false, error: 'id e name obrigatórios' });
    }
    const result = await upsertCostCenter(body);
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true, id: body.id });
  });

  app.put('/api/operator/finance/cost-centers/:id', async (req, res) => {
    const id = req.params.id;
    const body = { ...(req.body as CostCenter), id };
    const result = await upsertCostCenter(body);
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true, id });
  });

  app.delete('/api/operator/finance/cost-centers/:id', async (req, res) => {
    const result = await deleteCostCenter(req.params.id);
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true });
  });

  app.post('/api/operator/finance/ledger', async (req, res) => {
    const body = req.body as DreGranularItem;
    if (!body?.id || !body?.name) {
      return res.status(400).json({ success: false, error: 'id e name obrigatórios' });
    }
    const cbErr = costBehaviorValidationError(body.costBehavior ?? null);
    if (cbErr) return res.status(400).json({ success: false, error: cbErr });
    const result = await upsertLedgerLine(body);
    if (result.ok === false) {
      const code = result.error.includes('inválid') ? 400 : 500;
      return res.status(code).json({ success: false, error: result.error });
    }
    return res.json({ success: true, id: body.id });
  });

  app.put('/api/operator/finance/ledger/:id', async (req, res) => {
    const id = req.params.id;
    const body = { ...(req.body as DreGranularItem), id };
    const cbErr = costBehaviorValidationError(body.costBehavior ?? null);
    if (cbErr) return res.status(400).json({ success: false, error: cbErr });
    const result = await upsertLedgerLine(body);
    if (result.ok === false) {
      const code = result.error.includes('inválid') ? 400 : 500;
      return res.status(code).json({ success: false, error: result.error });
    }
    return res.json({ success: true, id });
  });

  app.delete('/api/operator/finance/ledger/:id', async (req, res) => {
    const result = await deleteLedgerLine(req.params.id);
    if (result.ok === false) return res.status(500).json({ success: false, error: result.error });
    return res.json({ success: true });
  });
}
