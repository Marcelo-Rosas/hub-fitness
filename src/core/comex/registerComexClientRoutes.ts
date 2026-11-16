/**
 * Rotas Comex: clientes (importadores), despachantes e uso do limite Radar.
 * Registradas de dentro de registerPucomexRoutes, depois do comexGateway.
 */

import type { Express, Request, Response } from 'express';
import type { ComexBrokerInput, ComexClientInput } from '../../types/comex';
import { normalizeClientInput } from './comexRegistry';
import { getComexStore } from './comexStore';
import { computeRadarUsage } from './radarUsage';

export function sendError(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

/** Converte erros do store/SQL em status HTTP. Único ponto que casa mensagens. */
export function comexErrorStatus(err: unknown): { status: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown } | null)?.code;
  if (message === 'Cliente não encontrado para o cliente_id informado') return { status: 404, message };
  if (message === 'Despachante não encontrado para o broker_id informado') return { status: 400, message };
  if (message === 'CNPJ raiz já cadastrado para outro cliente') return { status: 409, message };
  if (code === '23505' || message.includes('UNIQUE constraint failed')) {
    return { status: 409, message: 'Registro duplicado' };
  }
  return { status: 500, message };
}

function fail(res: Response, err: unknown) {
  const { status, message } = comexErrorStatus(err);
  return sendError(res, status, message);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function validYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function registerComexClientRoutes(app: Express): void {
  app.get('/api/comex/clients', async (_req: Request, res: Response) => {
    try {
      const store = await getComexStore();
      res.json({ success: true, data: await store.listClients() });
    } catch (err) {
      fail(res, err);
    }
  });

  const saveClient = async (req: Request, res: Response, id?: string) => {
    try {
      const store = await getComexStore();
      if (id && !(await store.getClient(id))) return sendError(res, 404, 'Cliente não encontrado');
      let input: ComexClientInput;
      try {
        input = normalizeClientInput({ ...(req.body || {}), id });
      } catch (err) {
        return sendError(res, 400, err instanceof Error ? err.message : String(err));
      }
      const data = await store.upsertClient(input);
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err);
    }
  };

  app.post('/api/comex/clients', (req, res) => saveClient(req, res));
  app.put('/api/comex/clients/:id', (req, res) => saveClient(req, res, req.params.id));

  app.delete('/api/comex/clients/:id', async (req, res) => {
    try {
      const store = await getComexStore();
      const r = await store.deleteClient(req.params.id);
      if (r === 'not_found') return sendError(res, 404, 'Cliente não encontrado');
      if (r === 'has_processes') {
        return sendError(res, 409, 'Cliente possui processos vinculados e não pode ser excluído');
      }
      res.json({ success: true });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get('/api/comex/clients/:id/radar-usage', async (req, res) => {
    try {
      const raw = req.query.ref;
      const ref = raw === undefined || raw === '' ? todayYmd() : String(raw);
      if (!validYmd(ref)) return sendError(res, 400, 'Parâmetro ref inválido: use AAAA-MM-DD');
      const store = await getComexStore();
      const client = await store.getClient(req.params.id);
      if (!client) return sendError(res, 404, 'Cliente não encontrado');
      const processes = await store.listProcesses();
      res.json({ success: true, data: computeRadarUsage(client, processes, { refDate: ref }) });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get('/api/comex/brokers', async (_req, res) => {
    try {
      const store = await getComexStore();
      res.json({ success: true, data: await store.listBrokers() });
    } catch (err) {
      fail(res, err);
    }
  });

  const saveBroker = async (req: Request, res: Response, id?: string) => {
    try {
      const body = (req.body || {}) as ComexBrokerInput;
      if (!String(body.name ?? '').trim()) return sendError(res, 400, 'Nome do despachante é obrigatório');
      const store = await getComexStore();
      const data = await store.upsertBroker({ ...body, id });
      res.json({ success: true, data });
    } catch (err) {
      fail(res, err);
    }
  };

  app.post('/api/comex/brokers', (req, res) => saveBroker(req, res));
  app.put('/api/comex/brokers/:id', (req, res) => saveBroker(req, res, req.params.id));

  app.delete('/api/comex/brokers/:id', async (req, res) => {
    try {
      const store = await getComexStore();
      const r = await store.deleteBroker(req.params.id);
      if (r === 'not_found') return sendError(res, 404, 'Despachante não encontrado');
      if (r === 'in_use') return sendError(res, 409, 'Despachante em uso por clientes e não pode ser excluído');
      res.json({ success: true });
    } catch (err) {
      fail(res, err);
    }
  });
}
