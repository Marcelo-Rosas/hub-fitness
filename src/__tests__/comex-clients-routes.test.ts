import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerPucomexRoutes } from '../core/comex/registerPucomexRoutes';
import { resetComexStoreForTests } from '../core/comex/comexStore';

const ENV_KEYS = ['COMEX_OPERATOR_TOKEN', 'COMEX_DB_PATH', 'DATABASE_URL', 'PUCOMEX_LIVE'] as const;
const saved: Record<string, string | undefined> = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

let baseUrl = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(async () => {
  process.env.COMEX_OPERATOR_TOKEN = 't';
  process.env.COMEX_DB_PATH = ':memory:';
  delete process.env.DATABASE_URL;
  resetComexStoreForTests();
  const app = express();
  app.use(express.json());
  registerPucomexRoutes(app);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  process.env.COMEX_OPERATOR_TOKEN = 't';
  process.env.COMEX_DB_PATH = ':memory:';
  delete process.env.DATABASE_URL;
  resetComexStoreForTests();
});

afterAll(() => {
  server?.close();
  resetComexStoreForTests();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const api = (method: string, p: string, body?: unknown, headers: Record<string, string> = { 'x-comex-token': 't' }) =>
  fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const mkClient = async (over: Record<string, unknown> = {}) =>
  (
    await (
      await api('POST', '/api/comex/clients', {
        cnpj_root: '60.450.605',
        legal_name: 'RM ACADEMIA LTDA',
        radar_modality: 'limitada_50k',
        ...over,
      })
    ).json()
  ).data;

describe('rotas de clientes/despachantes/radar', () => {
  it('cria cliente, processo ligado e devolve radar', async () => {
    const c = await mkClient();
    const p = await (
      await api('POST', '/api/comex/processes', {
        cliente_id: c.id,
        payload: { type: 'importacao', fob_value_usd: 45000, eta_date: '2026-11-01' },
      })
    ).json();
    expect(p.success).toBe(true);
    expect(p.radar.level).toBe('atencao');
    expect(p.radar.usedUsd).toBe(45000);
    expect(p.data.cliente_id).toBe(c.id);
    const list = await (await api('GET', '/api/comex/processes')).json();
    expect(list.data[0].cliente_id).toBe(c.id);
  });

  it('processo sem cliente_id → 400; cliente inexistente → 404', async () => {
    const r = await api('POST', '/api/comex/processes', { payload: {} });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('Selecione o cliente importador');
    expect((await api('POST', '/api/comex/processes', { cliente_id: 'nope', payload: {} })).status).toBe(404);
  });

  it('cliente com processo não é excluído (409); sem processo → 200; inexistente → 404', async () => {
    const c = await mkClient();
    await api('POST', '/api/comex/processes', { cliente_id: c.id, payload: { type: 'importacao' } });
    expect((await api('DELETE', `/api/comex/clients/${c.id}`)).status).toBe(409);
    const c2 = await mkClient({ cnpj_root: '11.222.333', legal_name: 'Outra LTDA' });
    expect((await api('DELETE', `/api/comex/clients/${c2.id}`)).status).toBe(200);
    expect((await api('DELETE', `/api/comex/clients/${c2.id}`)).status).toBe(404);
  });

  it('cnpj_root duplicado → 409; inválido → 400', async () => {
    await mkClient();
    const dup = await api('POST', '/api/comex/clients', { cnpj_root: '60450605', legal_name: 'Outra' });
    expect(dup.status).toBe(409);
    const bad = await api('POST', '/api/comex/clients', { cnpj_root: '123', legal_name: 'X' });
    expect(bad.status).toBe(400);
  });

  it('PUT cliente atualiza e GET lista; PUT inexistente → 404', async () => {
    const c = await mkClient();
    const u = await api('PUT', `/api/comex/clients/${c.id}`, { cnpj_root: '60450605', legal_name: 'Novo Nome' });
    expect(u.status).toBe(200);
    expect((await u.json()).data.legal_name).toBe('Novo Nome');
    const list = await (await api('GET', '/api/comex/clients')).json();
    expect(list.data).toHaveLength(1);
    expect((await api('PUT', '/api/comex/clients/nope', { cnpj_root: '60450605', legal_name: 'X' })).status).toBe(404);
  });

  it('sem token → 401 em /clients e /brokers', async () => {
    expect((await api('GET', '/api/comex/clients', undefined, {})).status).toBe(401);
    expect((await api('GET', '/api/comex/brokers', undefined, {})).status).toBe(401);
  });

  it('radar-usage: ref válido, padrão hoje, inválido → 400, cliente inexistente → 404', async () => {
    const c = await mkClient();
    await api('POST', '/api/comex/processes', {
      cliente_id: c.id,
      payload: { type: 'importacao', fob_value_usd: 10000, eta_date: '2026-11-01' },
    });
    const ok = await (await api('GET', `/api/comex/clients/${c.id}/radar-usage?ref=2026-11-16`)).json();
    expect(ok.data.usedUsd).toBe(10000);
    expect((await api('GET', `/api/comex/clients/${c.id}/radar-usage`)).status).toBe(200);
    expect((await api('GET', `/api/comex/clients/${c.id}/radar-usage?ref=2026-13-45`)).status).toBe(400);
    expect((await api('GET', `/api/comex/clients/${c.id}/radar-usage?ref=abc`)).status).toBe(400);
    expect((await api('GET', '/api/comex/clients/nope/radar-usage')).status).toBe(404);
  });

  it('despachantes: CRUD, delete em uso → 409, nome vazio → 400', async () => {
    const b = (await (await api('POST', '/api/comex/brokers', { name: 'Despachante A' })).json()).data;
    expect(b.name).toBe('Despachante A');
    expect((await api('POST', '/api/comex/brokers', { name: ' ' })).status).toBe(400);
    expect((await api('PUT', `/api/comex/brokers/${b.id}`, { name: 'Despachante B' })).status).toBe(200);
    expect(((await (await api('GET', '/api/comex/brokers')).json()).data as unknown[]).length).toBe(1);
    await mkClient({ broker_id: b.id });
    expect((await api('DELETE', `/api/comex/brokers/${b.id}`)).status).toBe(409);
    expect((await api('POST', '/api/comex/clients', { cnpj_root: '99999999', legal_name: 'Z', broker_id: 'nope' })).status).toBe(400);
    expect((await api('DELETE', '/api/comex/brokers/nope')).status).toBe(404);
    expect((await api('PUT', '/api/comex/brokers/nope', { name: 'Fantasma' })).status).toBe(404);
    expect(((await (await api('GET', '/api/comex/brokers')).json()).data as unknown[]).length).toBe(1);
  });

  it('PUT processo sem cliente_id mantém client_name do cliente vinculado; troca e desvincula', async () => {
    const c = await mkClient();
    const p = (
      await (
        await api('POST', '/api/comex/processes', { cliente_id: c.id, payload: { type: 'importacao', fob_value_usd: 1000 } })
      ).json()
    ).data;
    const u = await (
      await api('PUT', `/api/comex/processes/${p.id}`, { payload: { type: 'importacao', fob_value_usd: 2000 } })
    ).json();
    expect(u.data.payload.client_name).toBe('RM ACADEMIA LTDA');
    expect(u.data.client_slug).toBe(c.slug);
    expect(u.data.cliente_id).toBe(c.id);
    expect(u.radar).toBeTruthy();

    const c2 = await mkClient({ cnpj_root: '11.222.333', legal_name: 'Outra LTDA' });
    const sw = await (await api('PUT', `/api/comex/processes/${p.id}`, { cliente_id: c2.id, payload: { type: 'importacao' } })).json();
    expect(sw.data.payload.client_name).toBe('Outra LTDA');

    const un = await (await api('PUT', `/api/comex/processes/${p.id}`, { cliente_id: null, payload: { type: 'importacao' } })).json();
    expect(un.data.cliente_id).toBeNull();
    expect(un.radar).toBeUndefined();

    expect((await api('PUT', `/api/comex/processes/${p.id}`, { cliente_id: 'nope', payload: {} })).status).toBe(404);
  });
});

describe('POST /api/comex/ncm/tratamentos', () => {
  it('junta TA + TTCE + documentos pelo Radar do cliente; erros do Portal viram mensagem', async () => {
    const { pucomexClient } = await import('../core/comex/pucomexClient');
    const { vi } = await import('vitest');
    const ta = vi.spyOn(pucomexClient, 'simulateTaImport').mockResolvedValue({
      status: 200, mode: 'live', path: '/talpco',
      data: [{ numeroTa: 'I0927', tipoTratamento: 'Requer LPCO', orgao: 'INMETRO', impedeDesembaraco: true,
        modelos: [{ codigo: 'I00014', nome: 'Registro de objeto', preenchimento: 'Ambos' }], efeitos: [] }],
    });
    const tt = vi.spyOn(pucomexClient, 'ttceChapter').mockResolvedValue({ status: 401, mode: 'live', data: { message: 'Usuário não autenticado' } });
    try {
      const c = await (await api('POST', '/api/comex/clients', { cnpj_root: '60450605', legal_name: 'RM ACADEMIA LTDA', radar_modality: 'limitada_50k' })).json();
      const r = await (await api('POST', '/api/comex/ncm/tratamentos', { ncmCode: '9506.91.00', country: 'China (CN)', clienteId: c.data.id })).json();
      expect(ta).toHaveBeenCalledWith('95069100', 'CN');
      expect(r.data.ta.exigeLpco).toBe(true);
      expect(r.data.ttce).toBeNull();
      expect(r.data.ttceError).toMatch(/Portal HTTP 401/);
      expect(r.data.documentos).toContain('DI (Radar Limitado — DUIMP indisponível)');
      expect(r.data.documentos.some((d: string) => d.startsWith('LPCO INMETRO'))).toBe(true);
      expect(r.data.simuladorUrl).toMatch(/receita\.fazenda/);
    } finally {
      ta.mockRestore();
      tt.mockRestore();
    }
  });

  it('NCM inválida → 400; sem token → 401', async () => {
    expect((await api('POST', '/api/comex/ncm/tratamentos', { ncmCode: '9506' })).status).toBe(400);
    expect((await api('POST', '/api/comex/ncm/tratamentos', { ncmCode: '95069100' }, {})).status).toBe(401);
  });
});

describe('cadastros 100% metadado (field-defs client/broker)', () => {
  const defsOf = async (entity: string) =>
    (await (await api('GET', `/api/comex/field-defs?entity=${entity}`)).json()).data as Array<{
      id: string;
      entity: string;
      field_key: string;
      label: string;
      data_type: string;
      enum_options: { value: string; label: string }[];
      ui_group: string | null;
    }>;

  it('GET ?entity=client devolve os defs do seed com grupo', async () => {
    const defs = await defsOf('client');
    expect(defs.length).toBe(17);
    expect(defs.every((d) => d.entity === 'client')).toBe(true);
    expect(defs.find((d) => d.field_key === 'radar_modality')?.ui_group).toBe('Radar');
    const broker = await defsOf('broker');
    expect(broker.map((d) => d.field_key)).toContain('name');
  });

  it('cliente com radar_status fora das opções → 400', async () => {
    const r = await api('POST', '/api/comex/clients', { cnpj_root: '60450605', legal_name: 'X', radar_status: 'xyz' });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Situação/);
    const ok = await api('POST', '/api/comex/clients', { cnpj_root: '60450605', legal_name: 'X', radar_status: 'suspensa' });
    expect(ok.status).toBe(200);
  });

  it('mudar valores de radar_modality → 400; mudar só rótulo/ordem → ok', async () => {
    const m = (await defsOf('client')).find((d) => d.field_key === 'radar_modality')!;
    const bad = await api('PUT', `/api/comex/field-defs/${m.id}`, {
      ...m,
      enum_options: [...m.enum_options, { value: 'nova', label: 'Nova' }],
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/Radar/);
    const badPost = await api('POST', '/api/comex/field-defs', {
      ...m,
      id: undefined,
      enum_options: m.enum_options.slice(1),
    });
    expect(badPost.status).toBe(400);
    const relabeled = m.enum_options.map((o) => ({ ...o, label: `${o.label}!` })).reverse();
    const ok = await api('PUT', `/api/comex/field-defs/${m.id}`, { ...m, label: 'Modalidade Radar', enum_options: relabeled });
    expect(ok.status).toBe(200);
    const after = (await defsOf('client')).find((d) => d.field_key === 'radar_modality')!;
    expect(after.label).toBe('Modalidade Radar');
    expect(after.enum_options[0].label).toBe('Ilimitada!');
  });

  it('DELETE de campo de sistema → 409; criar campo client fora das colunas → 400', async () => {
    const notes = (await defsOf('client')).find((d) => d.field_key === 'notes')!;
    const del = await api('DELETE', `/api/comex/field-defs/${notes.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).error).toBe('Campo de sistema não pode ser excluído (é coluna da tabela)');
    const create = await api('POST', '/api/comex/field-defs', {
      entity: 'client',
      field_key: 'inexistente',
      label: 'Inexistente',
      data_type: 'text',
    });
    expect(create.status).toBe(400);
    const procField = await api('POST', '/api/comex/field-defs', {
      entity: 'process',
      field_key: 'campo_livre',
      label: 'Livre',
      data_type: 'text',
    });
    expect(procField.status).toBe(200);
    const id = (await procField.json()).data.id;
    expect((await api('DELETE', `/api/comex/field-defs/${id}`)).status).toBe(200);
  });

  it('obrigatório do backend não pode ficar oculto nem opcional (400)', async () => {
    const legal = (await defsOf('client')).find((d) => d.field_key === 'legal_name')!;
    expect((await api('PUT', `/api/comex/field-defs/${legal.id}`, { ui_form: false })).status).toBe(400);
    expect((await api('PUT', `/api/comex/field-defs/${legal.id}`, { required: false })).status).toBe(400);
    expect((await api('PUT', `/api/comex/field-defs/${legal.id}`, { label: 'Razão social (nome empresarial)' })).status).toBe(200);
    const name = (await defsOf('broker')).find((d) => d.field_key === 'name')!;
    expect((await api('PUT', `/api/comex/field-defs/${name.id}`, { ui_form: false })).status).toBe(400);
    const notes = (await defsOf('client')).find((d) => d.field_key === 'notes')!;
    expect((await api('PUT', `/api/comex/field-defs/${notes.id}`, { ui_form: false })).status).toBe(200);
  });

  it('valor antigo fora das opções continua salvável se não mudou', async () => {
    const c = await mkClient({ rep_role_type: 'IMPEXP' });
    const role = (await defsOf('client')).find((d) => d.field_key === 'rep_role_type')!;
    // a opção IMPEXP sai da lista: o valor gravado vira "antigo"
    const ok = await api('PUT', `/api/comex/field-defs/${role.id}`, {
      enum_options: role.enum_options.filter((o) => o.value !== 'IMPEXP'),
    });
    expect(ok.status).toBe(200);
    const keep = await api('PUT', `/api/comex/clients/${c.id}`, {
      cnpj_root: '60450605',
      legal_name: 'RM ACADEMIA LTDA',
      rep_role_type: 'IMPEXP',
      notes: 'só mudei a nota',
    });
    expect(keep.status).toBe(200);
    const fresh = await api('POST', '/api/comex/clients', { cnpj_root: '11111111', legal_name: 'Novo', rep_role_type: 'IMPEXP' });
    expect(fresh.status).toBe(400);
  });
});

