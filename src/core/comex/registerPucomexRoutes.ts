/**
 * Rotas Express — proxy PUCOMEX + CRUD Comex (DB metadado)
 */

import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import { PUCOMEX_ENDPOINT_CATALOG, PUCOMEX_MODULE_LINKS } from './endpoints';
import {
  PUCOMEX_DOCS_AUTH,
  PUCOMEX_DOCS_ENV,
  PUCOMEX_DOCS_HOME,
  PUCOMEX_ENVIRONMENTS,
  PUCOMEX_ROLE_TYPES,
  TABADU_PRODUCAO,
  TABADU_VALIDACAO,
  type PucomexRoleType,
} from './environments';
import { pucomexClient, pucomexRepClient } from './pucomexClient';
import { comexGateway, comexGuardStatus } from './comexGuard';
import {
  consultValueFromProcess,
  getComexStore,
  getStoreFallbackReason,
  type ComexStore,
} from './comexStore';
import { indexComexDocuments } from './docsIndexer';
import { extractProcessFromPdfs, mergeExtracted } from './pdfExtract';
import { ingestPdfBuffer } from './pdfIngest';
import { comexErrorStatus, registerComexClientRoutes } from './registerComexClientRoutes';
import { computeRadarUsage, processRadarDate, type RadarUsage } from './radarUsage';
import {
  buildRequiredDocuments,
  ISO2_TO_SISCOMEX,
  parseCountryIso2,
  parseTtceFile,
  SIMULADOR_RECEITA_URL,
  summarizeTa,
  ttceDiagnostics,
  ttceForNcm,
} from './comexTreatments';
import {
  isRegistryEntity,
  isRequiredSystemField,
  isSystemField,
  lockedOptionsError,
  REGISTRY_COLUMNS,
  todayYmd,
} from './comexRegistry';
import type { ComexFieldDef, ComexFieldDefInput, ComexProcessRecord } from '../../types/comex';

const FIELD_ENTITIES = ['process', 'document', 'client', 'broker'];

/** Erro do Portal legível: "message (code)" quando o corpo é JSON; senão o texto cortado. */
function portalErrorText(data: unknown): string {
  const body = data as { message?: unknown; code?: unknown } | null;
  if (body && typeof body === 'object' && typeof body.message === 'string') {
    return body.code ? `${body.message} (${String(body.code)})` : body.message;
  }
  return (typeof data === 'string' ? data : JSON.stringify(data)).slice(0, 300);
}

/** Regras de metadado de cliente/despachante: entidade, coluna real, valores travados. */
function fieldDefError(def: ComexFieldDefInput, existing?: ComexFieldDef): string | null {
  if (!FIELD_ENTITIES.includes(def.entity)) return `Entidade inválida: ${def.entity}`;
  if (existing && isSystemField(existing.entity, existing.field_key)) {
    if (existing.entity !== def.entity || existing.field_key !== def.field_key) {
      return 'Campo de sistema não pode mudar de entidade nem de chave';
    }
  }
  if (isRegistryEntity(def.entity) && !REGISTRY_COLUMNS[def.entity].includes(def.field_key)) {
    const nome = def.entity === 'client' ? 'cliente' : 'despachante';
    return `Campo "${def.field_key}" não é coluna do cadastro de ${nome} — não há onde gravar`;
  }
  if (isRequiredSystemField(def.entity, def.field_key) && (def.ui_form === false || def.required !== true)) {
    return `Campo "${def.label || def.field_key}" é exigido pelo cadastro — não pode ficar oculto nem opcional`;
  }
  return lockedOptionsError(def);
}

function defaultDocsRoot(): string {
  return process.env.COMEX_DOCS_ROOT || 'D:\\Comex';
}

function sendError(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function isPathInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function storeOf(): Promise<ComexStore> {
  return getComexStore();
}

export async function bootstrapComexStore(): Promise<void> {
  let store: ComexStore;
  try {
    store = await getComexStore();
  } catch (err) {
    console.warn(
      `📁 Comex: store indisponível — app sobe sem Comex. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return;
  }

  const root = defaultDocsRoot();
  try {
    let rootOk = false;
    try {
      rootOk = fs.existsSync(root);
    } catch (err) {
      console.warn(
        `📁 Comex ${store.driver}: existsSync ${root} falhou — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }
    if (!rootOk) {
      console.log(`📁 Comex ${store.driver}: pasta ${root} ausente — indexação adiada`);
      return;
    }
    const result = await indexComexDocuments(store, root);
    console.log(
      `📁 Comex ${store.driver}: ${result.documents} docs / ${result.processes} processos (${result.linked} ligados) ← ${result.root}`,
    );
  } catch (err) {
    console.warn(
      `📁 Comex ${store.driver}: indexação falhou (${root}) — app sobe sem docs. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export function registerPucomexRoutes(app: Express): void {
  app.use('/api/comex', comexGateway);
  registerComexClientRoutes(app);

  app.get('/api/comex/pucomex/status', async (_req, res) => {
    const store = await storeOf();
    res.json({
      success: true,
      status: pucomexClient.getStatus(),
      session: pucomexClient.getSessionPublic(),
      representante: { status: pucomexRepClient.getStatus(), session: pucomexRepClient.getSessionPublic() },
      guard: comexGuardStatus(),
      environments: PUCOMEX_ENVIRONMENTS,
      roleTypes: PUCOMEX_ROLE_TYPES,
      store: { driver: store.driver, docsRoot: defaultDocsRoot(), fallbackReason: getStoreFallbackReason() },
      docs: {
        home: PUCOMEX_DOCS_HOME,
        auth: PUCOMEX_DOCS_AUTH,
        environments: PUCOMEX_DOCS_ENV,
        tabaduValidacao: TABADU_VALIDACAO,
        tabaduProducao: TABADU_PRODUCAO,
      },
    });
  });

  app.get('/api/comex/pucomex/catalog', (_req, res) => {
    res.json({
      success: true,
      endpoints: PUCOMEX_ENDPOINT_CATALOG,
      moduleLinks: PUCOMEX_MODULE_LINKS,
    });
  });

  app.post('/api/comex/pucomex/authenticate', async (req, res) => {
    const force = !!req.body?.force;
    const rawRole = req.body?.roleType;
    let roleType: PucomexRoleType | undefined;
    if (rawRole !== undefined && rawRole !== null && rawRole !== '') {
      const code = String(rawRole).toUpperCase();
      if (!PUCOMEX_ROLE_TYPES.some((r) => r.code === code)) {
        return sendError(res, 400, `roleType inválido: ${code}`);
      }
      roleType = code as PucomexRoleType;
    }
    // Autentica os dois perfis configurados; roleType do corpo vale só para a empresa.
    const [result, rep] = await Promise.all([
      pucomexClient.authenticate(force, roleType),
      pucomexRepClient.isCertConfigured() ? pucomexRepClient.authenticate(force) : Promise.resolve(null),
    ]);
    const status = result.success ? 200 : result.code === 'PUCOMEX_AUTH_THROTTLE' ? 429 : 401;
    res.status(result.mode === 'demo' && result.success ? 200 : status).json({
      success: result.success || result.mode === 'demo',
      mode: result.mode,
      session: result.session,
      error: result.error,
      code: result.code,
      portalStatus: pucomexClient.getStatus(),
      representante: rep
        ? {
            success: rep.success,
            mode: rep.mode,
            session: rep.session,
            error: rep.error,
            code: rep.code,
            portalStatus: pucomexRepClient.getStatus(),
          }
        : null,
    });
  });

  app.post('/api/comex/due/consult', async (req, res) => {
    try {
      const dueNumber = String(req.body?.dueNumber || '').trim();
      if (!dueNumber) {
        return res.status(400).json({ success: false, error: 'dueNumber obrigatório' });
      }
      const result = await pucomexClient.consultDue(dueNumber);
      return res.status(result.status >= 400 && result.mode === 'live' ? result.status : 200).json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        data: result.data,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/comex/duimp/consult', async (req, res) => {
    try {
      const duimpNumber = String(req.body?.duimpNumber || '').trim();
      const versao = String(req.body?.versao || '1');
      if (!duimpNumber) {
        return res.status(400).json({ success: false, error: 'duimpNumber obrigatório' });
      }
      const result = await pucomexClient.consultDuimp(duimpNumber, versao);
      return res.status(result.status >= 400 && result.mode === 'live' ? result.status : 200).json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        data: result.data,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/comex/cct/consult', async (req, res) => {
    try {
      const accessKey = String(req.body?.accessKey || req.body?.identificador || '').trim();
      const modal = (req.body?.modal === 'exportacao' ? 'exportacao' : 'aquaviario') as
        | 'exportacao'
        | 'aquaviario';
      if (!accessKey) {
        return res.status(400).json({ success: false, error: 'accessKey/identificador obrigatório' });
      }
      const result = await pucomexClient.consultCct(accessKey, modal);
      return res.status(result.status >= 400 && result.mode === 'live' ? result.status : 200).json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        data: result.data,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/comex/ncm/consult', async (req, res) => {
    try {
      const ncmCode = String(req.body?.ncmCode || '').trim();
      if (!ncmCode) return res.status(400).json({ success: false, error: 'ncmCode obrigatório' });
      const result = await pucomexClient.consultNcm(ncmCode);
      return res.json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        data: result.data,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Tratamentos da NCM: administrativo (LPCO/anuentes) + tributário (TTCE) + documentos pelo Radar do cliente
  app.post('/api/comex/ncm/tratamentos', async (req, res) => {
    try {
      const ncm = String(req.body?.ncmCode || '').replace(/\D/g, '');
      if (ncm.length !== 8) return sendError(res, 400, 'ncmCode deve ter 8 dígitos');
      const paisIso2 = parseCountryIso2(String(req.body?.country || '')) ?? 'CN';
      const clienteId = typeof req.body?.clienteId === 'string' ? req.body.clienteId : '';
      const client = clienteId ? await (await storeOf()).getClient(clienteId) : null;

      // IMPEXP (e-CPF do representante) quando configurado; senão a empresa (OPERPORT).
      const perfilUsado = pucomexRepClient.isCertConfigured() ? 'representante' : 'empresa';
      const portal = perfilUsado === 'representante' ? pucomexRepClient : pucomexClient;
      const [taRes, ttceRes] = await Promise.allSettled([
        portal.simulateTaImport(ncm, paisIso2),
        portal.ttceChapter(ncm.slice(0, 2), todayYmd()),
      ]);
      const errorOf = (r: PromiseSettledResult<{ status: number; data: unknown; mode: string }>) =>
        r.status === 'rejected'
          ? String((r.reason as Error)?.message ?? r.reason)
          : r.value.mode === 'demo'
            ? 'Modo DEMO — sem consulta ao Portal'
            : r.value.status >= 400
              ? `Portal HTTP ${r.value.status}: ${portalErrorText(r.value.data)}`
              : null;

      const paisCodigo = ISO2_TO_SISCOMEX[paisIso2] ?? null;
      const taError = errorOf(taRes);
      const ta = !taError && taRes.status === 'fulfilled' ? summarizeTa(taRes.value.data) : null;
      const ttceError = errorOf(ttceRes);
      const ttceRaw = !ttceError && ttceRes.status === 'fulfilled' ? ttceRes.value.data : undefined;
      const ttce = ttceRaw !== undefined ? ttceForNcm(parseTtceFile(ttceRaw), ncm, paisCodigo) : null;
      const ttceVazio = !!ttce && ttce.tributos.length === 0 && ttce.normais.length === 0 && ttce.opcionais.length === 0;
      const ttceDiag = ttceVazio ? ttceDiagnostics(ttceRaw, ncm, paisCodigo) : undefined;

      return res.json({
        success: true,
        data: {
          ncm,
          paisIso2,
          cliente: client ? { id: client.id, legal_name: client.legal_name, radar_modality: client.radar_modality } : null,
          ta,
          taError,
          ttce,
          ttceError,
          ttceDiag,
          perfilUsado,
          ttcePaisConhecido: ISO2_TO_SISCOMEX[paisIso2] != null,
          documentos: buildRequiredDocuments({ radarModality: client?.radar_modality ?? null, ta }),
          simuladorUrl: SIMULADOR_RECEITA_URL,
        },
      });
    } catch (err: unknown) {
      return sendError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/comex/catalogo/consult', async (req, res) => {
    try {
      const query = (req.body?.query || {}) as Record<string, string>;
      const result = await pucomexClient.consultCatalogoProduto(query);
      return res.json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        data: result.data,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/comex/pucomex/proxy', async (req, res) => {
    try {
      const method = String(req.body?.method || 'GET').toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
        return sendError(res, 400, `method inválido: ${method}`);
      }
      // Escrita no Portal (registro/retificação) só com opt-in explícito no servidor.
      if (method !== 'GET' && process.env.PUCOMEX_PROXY_ALLOW_WRITE !== 'true') {
        return sendError(
          res,
          403,
          'Proxy PUCOMEX somente leitura (GET). Defina PUCOMEX_PROXY_ALLOW_WRITE=true para liberar escrita.',
        );
      }
      const reqPath = String(req.body?.path || '').trim();
      if (!reqPath.startsWith('/') || reqPath.startsWith('//') || reqPath.includes('://')) {
        return sendError(res, 400, 'path deve ser relativo ao Portal e começar com /');
      }
      const result = await pucomexClient.apiRequest(
        method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        reqPath,
        req.body?.body,
      );
      return res.status(result.mode === 'live' && result.status >= 400 ? result.status : 200).json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        httpStatus: result.status,
        data: result.data,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/comex/field-defs', async (req, res) => {
    const store = await storeOf();
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const data = await store.listFieldDefs(entity);
    res.json({ success: true, data });
  });

  app.post('/api/comex/field-defs', async (req, res) => {
    const body = req.body || {};
    if (!body.entity || !body.field_key || !body.label || !body.data_type) {
      return sendError(res, 400, 'entity, field_key, label e data_type obrigatórios');
    }
    const store = await storeOf();
    const existing = (await store.listFieldDefs(body.entity)).find((f) => f.field_key === body.field_key);
    const invalid = fieldDefError(body, existing);
    if (invalid) return sendError(res, 400, invalid);
    const data = await store.upsertFieldDef(body);
    res.json({ success: true, data });
  });

  app.put('/api/comex/field-defs/:id', async (req, res) => {
    const store = await storeOf();
    const existing = (await store.listFieldDefs()).find((f) => f.id === req.params.id);
    const merged = { ...(existing || {}), ...(req.body || {}), id: req.params.id } as ComexFieldDefInput & { id: string };
    if (!merged.entity || !merged.field_key || !merged.label || !merged.data_type) {
      return sendError(res, 400, 'entity, field_key, label e data_type obrigatórios');
    }
    const invalid = fieldDefError(merged, existing);
    if (invalid) return sendError(res, 400, invalid);
    const data = await store.upsertFieldDef(merged);
    res.json({ success: true, data });
  });

  app.delete('/api/comex/field-defs/:id', async (req, res) => {
    const store = await storeOf();
    const existing = (await store.listFieldDefs()).find((f) => f.id === req.params.id);
    if (existing && isSystemField(existing.entity, existing.field_key)) {
      return sendError(res, 409, 'Campo de sistema não pode ser excluído (é coluna da tabela)');
    }
    const ok = await store.deleteFieldDef(req.params.id);
    if (!ok) return sendError(res, 404, 'Campo não encontrado');
    res.json({ success: true });
  });

  app.get('/api/comex/processes', async (_req, res) => {
    const store = await storeOf();
    const data = await store.listProcesses();
    res.json({ success: true, driver: store.driver, data });
  });

  async function radarFor(store: ComexStore, proc: ComexProcessRecord): Promise<RadarUsage | undefined> {
    if (!proc.cliente_id) return undefined;
    const client = await store.getClient(proc.cliente_id);
    if (!client) return undefined;
    return computeRadarUsage(client, await store.listProcesses(), { refDate: processRadarDate(proc) });
  }

  app.post('/api/comex/processes', async (req: Request, res: Response) => {
    try {
      const store = await storeOf();
      const cliente_id = typeof req.body?.cliente_id === 'string' ? req.body.cliente_id.trim() : '';
      if (!cliente_id) return sendError(res, 400, 'Selecione o cliente importador');
      const payload = (req.body?.payload && typeof req.body.payload === 'object'
        ? req.body.payload
        : req.body) as Record<string, unknown>;
      const data = await store.createProcess({
        code: req.body?.code,
        client_slug: req.body?.client_slug,
        cliente_id,
        payload,
      });
      res.json({ success: true, data, radar: await radarFor(store, data) });
    } catch (err) {
      const { status, message } = comexErrorStatus(err);
      sendError(res, status, message);
    }
  });

  app.put('/api/comex/processes/:id', async (req, res) => {
    try {
      const store = await storeOf();
      const body = req.body || {};
      const payload =
        body.payload && typeof body.payload === 'object'
          ? body.payload
          : (() => {
              const {
                id: _id,
                code: _code,
                client_slug: _slug,
                cliente_id: _cid,
                documents: _docs,
                created_at: _c,
                updated_at: _u,
                ...rest
              } = body;
              return rest;
            })();
      const current = await store.getProcess(req.params.id);
      if (!current) return sendError(res, 404, 'Processo não encontrado');
      // Sem cliente_id no body: reaplica o cliente já vinculado (mantém client_name/slug coerentes).
      const cliente_id = body.cliente_id !== undefined ? body.cliente_id : current.cliente_id;
      const data = await store.updateProcess(req.params.id, {
        code: body.code,
        client_slug: body.client_slug,
        cliente_id: cliente_id || null,
        payload,
      });
      if (!data) return sendError(res, 404, 'Processo não encontrado');
      res.json({ success: true, data, radar: await radarFor(store, data) });
    } catch (err) {
      const { status, message } = comexErrorStatus(err);
      sendError(res, status, message);
    }
  });

  app.delete('/api/comex/processes/:id', async (req, res) => {
    const store = await storeOf();
    const ok = await store.deleteProcess(req.params.id);
    if (!ok) return sendError(res, 404, 'Processo não encontrado');
    res.json({ success: true });
  });

  app.post('/api/comex/processes/:id/extract', async (req, res) => {
    try {
      const store = await storeOf();
      const proc = await store.getProcess(req.params.id);
      if (!proc) return sendError(res, 404, 'Processo não encontrado');
      const fieldDefs = await store.listFieldDefs('process');
      const docs = proc.documents || (await store.listDocuments(proc.id));
      const filtered = typeof req.body?.documentId === 'string'
        ? docs.filter((d) => d.id === req.body.documentId)
        : docs;
      const extracted = await extractProcessFromPdfs(filtered, fieldDefs);
      const mode = req.body?.apply === 'replace' ? 'replace' : req.body?.apply === 'empty' ? 'empty' : 'preview';
      let payload = proc.payload;
      if (mode !== 'preview') {
        payload = mergeExtracted(proc.payload, extracted.fields, mode);
        await store.updateProcess(proc.id, { payload });
      }
      for (const src of extracted.sources) {
        const doc = docs.find((d) => d.id === src.id);
        if (!doc) continue;
        await store.upsertDocument({
          ...doc,
          meta: {
            ...doc.meta,
            extraction: {
              at: new Date().toISOString(),
              engine: extracted.engine,
              fields: extracted.fields,
            },
          },
        });
      }
      return res.json({
        success: true,
        mode,
        engine: extracted.engine,
        fields: extracted.fields,
        extra: extracted.extra,
        json: extracted.json,
        sources: extracted.sources,
        textPreview: extracted.textPreview,
        payload,
      });
    } catch (err: unknown) {
      return sendError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/comex/processes/:id/consult', async (req, res) => {
    try {
      const store = await storeOf();
      const proc = await store.getProcess(req.params.id);
      if (!proc) return sendError(res, 404, 'Processo não encontrado');
      const fieldDefs = await store.listFieldDefs('process');
      const consult = consultValueFromProcess(proc, fieldDefs);
      if (!consult) {
        return sendError(res, 400, 'Preencha o campo de declaração (metadado consult_key) para consultar o Portal');
      }
      const result =
        consult.kind === 'due'
          ? await pucomexClient.consultDue(consult.number)
          : await pucomexClient.consultDuimp(consult.number, consult.version);
      await store.updateProcess(proc.id, {
        payload: {
          ...proc.payload,
          last_pucomex_sync: new Date().toISOString(),
          pucomex_status:
            result.status < 400 ? 'Consultado no Portal' : `Portal HTTP ${result.status}`,
        },
      });
      return res.status(result.status >= 400 && result.mode === 'live' ? result.status : 200).json({
        success: result.status < 400 || result.mode === 'demo',
        mode: result.mode,
        path: result.path,
        httpStatus: result.status,
        consult,
        data: result.data,
      });
    } catch (err: unknown) {
      return sendError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.get('/api/comex/documents', async (req, res) => {
    const store = await storeOf();
    const processId =
      req.query.processId === 'null' ? null : typeof req.query.processId === 'string' ? req.query.processId : undefined;
    const data = await store.listDocuments(processId);
    res.json({ success: true, data });
  });

  app.post(
    '/api/comex/documents/ingest',
    express.raw({ type: () => true, limit: '40mb' }),
    async (req, res) => {
      try {
        const fileName = String(req.query.fileName || 'documento.pdf');
        const applyRaw = String(req.query.apply || 'empty');
        const apply = applyRaw === 'replace' || applyRaw === 'preview' ? applyRaw : 'empty';
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
        if (!buffer.length) return sendError(res, 400, 'PDF vazio');
        const store = await storeOf();
        const result = await ingestPdfBuffer({
          store,
          buffer,
          fileName,
          docsRoot: defaultDocsRoot(),
          apply,
        });
        const process = await store.getProcess(result.processId);
        res.json({ success: true, result, data: process });
      } catch (err: unknown) {
        return sendError(res, 500, err instanceof Error ? err.message : String(err));
      }
    },
  );

  app.post('/api/comex/documents/index', async (req, res) => {
    const store = await storeOf();
    // Raiz fixa do servidor — nunca caminho arbitrário vindo do cliente.
    const root = defaultDocsRoot();
    const result = await indexComexDocuments(store, root);
    let extracted = 0;
    if (req.body?.extract) {
      const fieldDefs = await store.listFieldDefs('process');
      const processes = await store.listProcesses();
      for (const proc of processes) {
        const docs = proc.documents || [];
        if (!docs.length) continue;
        try {
          const out = await extractProcessFromPdfs(docs, fieldDefs);
          const payload = mergeExtracted(proc.payload, out.fields, 'empty');
          await store.updateProcess(proc.id, { payload });
          extracted += 1;
        } catch {
          /* PDF ilegível — segue os demais */
        }
      }
    }
    res.json({ success: true, result: { ...result, extracted } });
  });

  app.patch('/api/comex/documents/:id', async (req, res) => {
    const store = await storeOf();
    const processId = req.body?.process_id === undefined ? null : req.body.process_id;
    const data = await store.linkDocument(req.params.id, processId);
    if (!data) return sendError(res, 404, 'Documento não encontrado');
    res.json({ success: true, data });
  });

  app.get('/api/comex/documents/:id/file', async (req, res) => {
    const store = await storeOf();
    const doc = await store.getDocument(req.params.id);
    if (!doc) return sendError(res, 404, 'Documento não encontrado');
    const target = path.resolve(doc.file_path);
    const root = defaultDocsRoot();
    if (fs.existsSync(root) && !isPathInside(root, target)) {
      return sendError(res, 403, 'Arquivo fora de COMEX_DOCS_ROOT');
    }
    if (!fs.existsSync(target)) return sendError(res, 404, 'Arquivo ausente no disco');
    return res.sendFile(target);
  });
}
