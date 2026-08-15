import type { Express, Request, Response } from 'express';
import { getIntranetStore } from './intranetStore';
import {
  cancel,
  executeStepDecision,
  previewApprover,
  resubmit,
  submit,
} from './approvalService';
import type { DecisionAction } from '../../types/intranet';
import { accountByCode, cadastroCoaOptions } from '../compras/researchFromCoa';
import { ORG_IDS } from './intranetStore';

function actorEmail(req: Request): string {
  const fromHeader = req.header('x-user-email');
  const fromBody = req.body?.actorEmail || req.body?.created_by;
  const fromQuery = typeof req.query.actorEmail === 'string' ? req.query.actorEmail : '';
  return String(fromHeader || fromBody || fromQuery || '')
    .toLowerCase()
    .trim();
}

/** Sócio-Fundador (e-mail board ou job_title seed). */
function requireSocio(req: Request, res: Response): boolean {
  const email = actorEmail(req);
  if (!email) {
    fail(res, 'SEM_PERMISSAO');
    return false;
  }
  if (email === 'socio@hubfitness.com.br') return true;
  const emp = getIntranetStore().getEmployeeByEmail(email);
  if (emp && emp.job_title_id === ORG_IDS.jobSocio) return true;
  fail(res, 'SEM_PERMISSAO');
  return false;
}

function statusForError(error: string): number {
  if (error === 'NOT_FOUND') return 404;
  if (error === 'VERSION_CONFLICT') return 409;
  if (error === 'SEM_PERMISSAO' || error === 'SEM_ALCADIA' || error === 'ACTOR_NAO_ASSIGNED') return 403;
  return 400;
}

function fail(res: Response, error: string) {
  return res.status(statusForError(error)).json({ success: false, error });
}

export function registerIntranetRoutes(app: Express): void {
  app.get('/api/intranet/org-tree', (_req, res) => {
    const store = getIntranetStore();
    res.json({
      success: true,
      data: {
        sectors: store.listSectors(),
        employees: store.listEmployees(),
        jobTitles: store.listJobTitles(),
      },
    });
  });

  app.get('/api/intranet/resolve-approver', (req, res) => {
    const email = actorEmail(req);
    if (!email) return fail(res, 'SEM_PERMISSAO');
    const preview = previewApprover(getIntranetStore(), email);
    if ('error' in preview) return fail(res, preview.error);
    return res.json({ success: true, data: preview });
  });

  app.get('/api/intranet/job-titles', (_req, res) => {
    res.json({ success: true, data: getIntranetStore().listJobTitles() });
  });

  app.post('/api/intranet/job-titles', (req, res) => {
    if (!requireSocio(req, res)) return;
    const b = req.body ?? {};
    const rec = getIntranetStore().upsertJobTitle({
      id: b.id,
      name: String(b.name || ''),
      can_request: Boolean(b.can_request),
      can_approve: Boolean(b.can_approve),
    });
    res.json({ success: true, data: rec });
  });

  app.patch('/api/intranet/job-titles/:id', (req, res) => {
    if (!requireSocio(req, res)) return;
    const store = getIntranetStore();
    const current = store.listJobTitles().find((j) => j.id === req.params.id);
    if (!current) return fail(res, 'NOT_FOUND');
    const b = req.body ?? {};
    const rec = store.upsertJobTitle({
      id: current.id,
      name: b.name != null ? String(b.name) : current.name,
      can_request: b.can_request != null ? Boolean(b.can_request) : current.can_request,
      can_approve: b.can_approve != null ? Boolean(b.can_approve) : current.can_approve,
    });
    res.json({ success: true, data: rec });
  });

  app.post('/api/intranet/sectors', (req, res) => {
    if (!requireSocio(req, res)) return;
    const b = req.body ?? {};
    const rec = getIntranetStore().upsertSector({
      id: b.id,
      code: String(b.code || '').toUpperCase(),
      name: String(b.name || ''),
      parent_id: b.parent_id || null,
    });
    res.json({ success: true, data: rec });
  });

  app.patch('/api/intranet/sectors/:id', (req, res) => {
    if (!requireSocio(req, res)) return;
    const store = getIntranetStore();
    const current = store.listSectors().find((s) => s.id === req.params.id);
    if (!current) return fail(res, 'NOT_FOUND');
    const b = req.body ?? {};
    const rec = store.upsertSector({
      id: current.id,
      code: b.code != null ? String(b.code).toUpperCase() : current.code,
      name: b.name != null ? String(b.name) : current.name,
      parent_id: b.parent_id === undefined ? current.parent_id : b.parent_id,
    });
    res.json({ success: true, data: rec });
  });

  app.get('/api/intranet/employees', (_req, res) => {
    res.json({ success: true, data: getIntranetStore().listEmployees() });
  });

  app.post('/api/intranet/employees', (req, res) => {
    if (!requireSocio(req, res)) return;
    const b = req.body ?? {};
    const rec = getIntranetStore().upsertEmployee({
      email: String(b.email || '').toLowerCase().trim(),
      full_name: String(b.full_name || ''),
      sector_id: String(b.sector_id),
      job_title_id: String(b.job_title_id),
      reports_to: b.reports_to || null,
      can_request_override: b.can_request_override ?? null,
      can_approve_override: b.can_approve_override ?? null,
      is_active: b.is_active !== false,
    });
    res.json({ success: true, data: rec });
  });

  app.patch('/api/intranet/employees/:id', (req, res) => {
    if (!requireSocio(req, res)) return;
    const store = getIntranetStore();
    const current = store.getEmployee(req.params.id);
    if (!current) return fail(res, 'NOT_FOUND');
    const b = req.body ?? {};
    const rec = store.upsertEmployee({
      id: current.id,
      email: b.email != null ? String(b.email).toLowerCase().trim() : current.email,
      full_name: b.full_name != null ? String(b.full_name) : current.full_name,
      sector_id: b.sector_id != null ? String(b.sector_id) : current.sector_id,
      job_title_id: b.job_title_id != null ? String(b.job_title_id) : current.job_title_id,
      reports_to: b.reports_to === undefined ? current.reports_to : b.reports_to,
      can_request_override:
        b.can_request_override === undefined ? current.can_request_override : b.can_request_override,
      can_approve_override:
        b.can_approve_override === undefined ? current.can_approve_override : b.can_approve_override,
      is_active: b.is_active === undefined ? current.is_active : Boolean(b.is_active),
    });
    res.json({ success: true, data: rec });
  });

  app.get('/api/intranet/coa-options', (_req, res) => {
    res.json({ success: true, data: cadastroCoaOptions() });
  });

  app.get('/api/intranet/cadastro', (_req, res) => {
    res.json({ success: true, data: getIntranetStore().listCadastroContatos() });
  });

  app.post('/api/intranet/cadastro', (req, res) => {
    if (!requireSocio(req, res)) return;
    try {
      const b = req.body ?? {};
      const code = String(b.account_code || '').trim();
      const acc = accountByCode(code);
      if (!acc) return fail(res, 'CONTA_INVALIDA');
      const rec = getIntranetStore().upsertCadastroContato({
        full_name: String(b.full_name || ''),
        phone: String(b.phone || ''),
        email: String(b.email || ''),
        account_code: code,
        account_name: acc.name,
      });
      res.json({ success: true, data: rec });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FALHA_CADASTRO';
      if (String(msg).includes('UNIQUE')) return fail(res, 'EMAIL_CONTA_DUPLICADO');
      return fail(res, msg);
    }
  });

  app.patch('/api/intranet/cadastro/:id', (req, res) => {
    if (!requireSocio(req, res)) return;
    try {
      const store = getIntranetStore();
      const current = store.listCadastroContatos().find((c) => c.id === req.params.id);
      if (!current) return fail(res, 'NOT_FOUND');
      const b = req.body ?? {};
      const code = b.account_code != null ? String(b.account_code).trim() : current.account_code;
      const acc = accountByCode(code);
      if (!acc) return fail(res, 'CONTA_INVALIDA');
      const rec = store.upsertCadastroContato({
        id: current.id,
        full_name: b.full_name != null ? String(b.full_name) : current.full_name,
        phone: b.phone != null ? String(b.phone) : current.phone,
        email: b.email != null ? String(b.email) : current.email,
        account_code: code,
        account_name: acc.name,
      });
      res.json({ success: true, data: rec });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FALHA_CADASTRO';
      if (String(msg).includes('UNIQUE')) return fail(res, 'EMAIL_CONTA_DUPLICADO');
      return fail(res, msg);
    }
  });

  app.delete('/api/intranet/cadastro/:id', (req, res) => {
    if (!requireSocio(req, res)) return;
    const ok = getIntranetStore().deleteCadastroContato(req.params.id);
    if (!ok) return fail(res, 'NOT_FOUND');
    res.json({ success: true });
  });

  app.get('/api/intranet/requests', (req, res) => {
    const store = getIntranetStore();
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const inbox = req.query.inbox === '1' || req.query.inbox === 'true';
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    let inboxEmployeeId: string | undefined;
    let requesterEmployeeId: string | undefined;
    if (inbox || mine) {
      const email = actorEmail(req);
      if (!email) {
        return res.status(401).json({
          success: false,
          error: 'SEM_PERMISSAO',
          hint: 'Header x-user-email obrigatório (ex.: compras@hubfitness.com.br). Abrir a URL no browser sem header retorna vazio.',
        });
      }
      const emp = store.getEmployeeByEmail(email);
      if (!emp) {
        return res.json({
          success: true,
          data: [],
          warning: `E-mail ${email} não está no cadastro intranet (employees). Login compras@ para mine=1; cfo@ usa inbox=1.`,
        });
      }
      if (inbox) inboxEmployeeId = emp.id;
      if (mine) requesterEmployeeId = emp.id;
    }
    res.json({
      success: true,
      data: store.listRequests({ status, inboxEmployeeId, requesterEmployeeId }),
    });
  });

  app.post('/api/intranet/requests', async (req: Request, res: Response) => {
    const email = actorEmail(req);
    if (!email) return fail(res, 'SEM_PERMISSAO');
    const b = req.body ?? {};
    if (!b.supplier_email || !b.supplier_name) {
      return res.status(400).json({ success: false, error: 'Fornecedor com e-mail é obrigatório.' });
    }
    const result = await submit(getIntranetStore(), {
      requesterEmail: email,
      title: String(b.title || b.code || 'RFQ'),
      payload: b.payload && typeof b.payload === 'object' ? b.payload : {},
      supplier_name: String(b.supplier_name),
      supplier_email: String(b.supplier_email),
    });
    if ('error' in result) return fail(res, result.error);
    return res.json({ success: true, data: result.request });
  });

  const decide =
    (action: DecisionAction) =>
    async (req: Request, res: Response) => {
      const email = actorEmail(req);
      if (!email) return fail(res, 'SEM_PERMISSAO');
      const b = req.body ?? {};
      const result = await executeStepDecision(getIntranetStore(), {
        requestId: req.params.id,
        actorEmail: email,
        action,
        reason: String(b.reason || ''),
        expectedVersion: Number(b.expectedVersion),
      });
      if ('error' in result) return fail(res, result.error);
      return res.json({ success: true, data: result.request });
    };

  app.post('/api/intranet/requests/:id/approve', decide('APPROVE'));
  app.post('/api/intranet/requests/:id/reject', decide('REJECT'));
  app.post('/api/intranet/requests/:id/request-changes', decide('REQUEST_CHANGES'));

  app.post('/api/intranet/requests/:id/resubmit', async (req, res) => {
    const email = actorEmail(req);
    if (!email) return fail(res, 'SEM_PERMISSAO');
    const result = await resubmit(getIntranetStore(), {
      requestId: req.params.id,
      actorEmail: email,
      expectedVersion: Number(req.body?.expectedVersion),
    });
    if ('error' in result) return fail(res, result.error);
    return res.json({ success: true, data: result.request });
  });

  app.post('/api/intranet/requests/:id/cancel', async (req, res) => {
    const email = actorEmail(req);
    if (!email) return fail(res, 'SEM_PERMISSAO');
    const result = await cancel(getIntranetStore(), {
      requestId: req.params.id,
      actorEmail: email,
      expectedVersion: Number(req.body?.expectedVersion),
    });
    if ('error' in result) return fail(res, result.error);
    return res.json({ success: true, data: result.request });
  });
}
