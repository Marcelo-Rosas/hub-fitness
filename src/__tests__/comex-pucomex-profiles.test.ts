import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPucomexRoutes } from '../core/comex/registerPucomexRoutes';
import { resetComexStoreForTests } from '../core/comex/comexStore';
import { PucomexClient, pucomexClient, pucomexRepClient } from '../core/comex/pucomexClient';
import { parseTtceFile, ttceDiagnostics } from '../core/comex/comexTreatments';

const ENV_KEYS = [
  'COMEX_OPERATOR_TOKEN',
  'COMEX_DB_PATH',
  'DATABASE_URL',
  'PUCOMEX_LIVE',
  'PUCOMEX_CERT_PFX_PATH',
  'PUCOMEX_CERT_PASSWORD',
  'PUCOMEX_CERT_THUMBPRINT',
  'PUCOMEX_USE_VECTRA_HUB_CERT',
  'PUCOMEX_ROLE_TYPE',
  'PUCOMEX_REP_CERT_PFX_PATH',
  'PUCOMEX_REP_CERT_PASSWORD',
  'PUCOMEX_REP_ROLE_TYPE',
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.PUCOMEX_USE_VECTRA_HUB_CERT = 'false';
  process.env.COMEX_OPERATOR_TOKEN = 't';
  process.env.COMEX_DB_PATH = ':memory:';
  resetComexStoreForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

let baseUrl = '';
let server: ReturnType<express.Express['listen']>;
let tmpDir = '';
let pfxPath: string | null = null;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerPucomexRoutes(app);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pucomex-rep-'));
  try {
    const key = path.join(tmpDir, 'k.pem');
    const crt = path.join(tmpDir, 'c.pem');
    pfxPath = path.join(tmpDir, 'rep.pfx');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt,
      '-days', '1', '-subj', '/CN=MARCELO TESTE:12345678900'], { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    execFileSync('openssl', ['pkcs12', '-export', '-inkey', key, '-in', crt, '-out', pfxPath,
      '-passout', 'pass:certo'], { stdio: 'ignore' });
  } catch {
    pfxPath = null;
  }
});
afterAll(() => {
  server?.close();
  resetComexStoreForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const api = (method: string, p: string, body?: unknown) =>
  fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-comex-token': 't' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('perfis de credencial PUCOMEX', () => {
  it('representante sem PFX: não configurado, live desligado, Role-Type IMPEXP; sem fallback Windows', () => {
    process.env.PUCOMEX_CERT_THUMBPRINT = 'ABCDEF';
    process.env.PUCOMEX_LIVE = 'true';
    const rep = new PucomexClient('representante');
    const st = rep.getStatus();
    expect(st.profile).toBe('representante');
    expect(st.certConfigured).toBe(false);
    expect(st.certThumbprint).toBeNull();
    expect(st.liveModeEnabled).toBe(false);
    expect(st.roleType).toBe('IMPEXP');
    expect(new PucomexClient('empresa').getStatus().roleType).toBe('OPERPORT');
  });

  it('envs e certificados independentes por perfil', (ctx) => {
    if (!pfxPath) ctx.skip();
    process.env.PUCOMEX_CERT_PFX_PATH = pfxPath!;
    process.env.PUCOMEX_CERT_PASSWORD = 'errada';
    process.env.PUCOMEX_REP_CERT_PFX_PATH = pfxPath!;
    process.env.PUCOMEX_REP_CERT_PASSWORD = 'certo';
    process.env.PUCOMEX_REP_ROLE_TYPE = 'impexp';
    const emp = new PucomexClient('empresa');
    const rep = new PucomexClient('representante');
    expect(emp.getStatus().certError).toMatch(/mac verify|PFX/);
    const rs = rep.getStatus();
    expect(rs.certError).toBeNull();
    expect(rs.certSource).toBe('pfx');
    expect(rs.liveModeEnabled).toBe(true);
    expect(rs.certSubject).toBe('MARCELO TESTE:12345678900');
    expect(rs.certValidTo).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    process.env.PUCOMEX_LIVE = 'false';
    expect(rep.getStatus().liveModeEnabled).toBe(false);
  });

  it('sessões independentes', () => {
    const emp = new PucomexClient('empresa');
    const rep = new PucomexClient('representante');
    rep.authenticateDemo();
    expect(rep.getSessionPublic()?.roleType).toBe('IMPEXP');
    expect(emp.getSessionPublic()).toBeNull();
  });

  it('singletons: pucomexClient = empresa, pucomexRepClient = representante', () => {
    expect(pucomexClient.profile).toBe('empresa');
    expect(pucomexRepClient.profile).toBe('representante');
  });

  it('GET /pucomex/status inclui o representante', async () => {
    const j = await (await api('GET', '/api/comex/pucomex/status')).json();
    expect(j.status.profile).toBe('empresa');
    expect(j.representante.status.profile).toBe('representante');
    expect(j.representante.status.roleType).toBe('IMPEXP');
    expect('session' in j.representante).toBe(true);
  });
});

const BOM = '﻿';
const chapterFile = (paises: string[]) => ({
  intervalosNcm: [
    {
      intervaloInicialNcm: '95069100',
      intervaloFinalNcm: '95069199',
      origensDestinosTratamentos: [
        {
          paisesOrigem: paises,
          todosPaisesOrigem: false,
          destinosTratamentos: [
            {
              tratamentosTributarios: [
                { tributo: { nome: 'II' }, regime: { nome: 'Normal' }, fundamentoLegal: { nome: 'TEC', codigo: '1', tipo: 'Normal' } },
              ],
            },
          ],
        },
      ],
    },
    { intervaloInicialNcm: '95060000', intervaloFinalNcm: '95060999', origensDestinosTratamentos: [] },
  ],
});

describe('TTCE: parse e diagnóstico', () => {
  it('parseTtceFile tira BOM e faz JSON.parse de string', () => {
    expect(parseTtceFile(BOM + JSON.stringify({ a: 1 }))).toEqual({ a: 1 });
    expect(parseTtceFile({ b: 2 })).toEqual({ b: 2 });
    expect(parseTtceFile('não é json')).toBe('não é json');
  });

  it('ttceDiagnostics: tipo, chaves, intervalos da NCM, países e gzip', () => {
    const d = ttceDiagnostics(chapterFile(['249', '23']), '95069100', '160');
    expect(d.tipo).toBe('object');
    expect(d.chaves).toEqual(['intervalosNcm']);
    expect(d.intervalosNcm).toBe(2);
    expect(d.intervalosDaNcm).toEqual([
      { inicio: '95069100', fim: '95069199', todosPaisesOrigem: false, paisesOrigem: ['249', '23'] },
    ]);
    expect(d.paisCodigo).toBe('160');
    const gz = ttceDiagnostics('\x1f�\b\0abc', '95069100', '160');
    expect(gz.tipo).toBe('string');
    expect(gz.pareceGzip).toBe(true);
    expect(gz.amostra?.length).toBeLessThanOrEqual(120);
    expect(ttceDiagnostics('PK\x03\x04xx', '95069100', '160').pareceZip).toBe(true);
  });
});

describe('POST /api/comex/ncm/tratamentos com perfis', () => {
  const okTa = { status: 200, mode: 'live' as const, path: '/talpco', data: [] };

  it('usa o representante quando configurado', async () => {
    vi.spyOn(pucomexRepClient, 'isCertConfigured').mockReturnValue(true);
    const repTa = vi.spyOn(pucomexRepClient, 'simulateTaImport').mockResolvedValue(okTa);
    const repTt = vi.spyOn(pucomexRepClient, 'ttceChapter').mockResolvedValue({
      status: 200, mode: 'live', data: BOM + JSON.stringify(chapterFile(['160'])),
    });
    const empTa = vi.spyOn(pucomexClient, 'simulateTaImport');
    const r = await (await api('POST', '/api/comex/ncm/tratamentos', { ncmCode: '95069100', country: 'CN' })).json();
    expect(r.data.perfilUsado).toBe('representante');
    expect(repTa).toHaveBeenCalled();
    expect(repTt).toHaveBeenCalled();
    expect(empTa).not.toHaveBeenCalled();
    expect(r.data.ttce.tributos).toEqual(['II']);
    expect(r.data.ttceDiag).toBeUndefined();
  });

  it('sem representante cai para a empresa; TTCE vazio traz ttceDiag', async () => {
    vi.spyOn(pucomexRepClient, 'isCertConfigured').mockReturnValue(false);
    const repTa = vi.spyOn(pucomexRepClient, 'simulateTaImport');
    vi.spyOn(pucomexClient, 'simulateTaImport').mockResolvedValue(okTa);
    vi.spyOn(pucomexClient, 'ttceChapter').mockResolvedValue({
      status: 200, mode: 'live', data: chapterFile(['249']),
    });
    const r = await (await api('POST', '/api/comex/ncm/tratamentos', { ncmCode: '95069100', country: 'CN' })).json();
    expect(r.data.perfilUsado).toBe('empresa');
    expect(repTa).not.toHaveBeenCalled();
    expect(r.data.ttce.normais).toEqual([]);
    expect(r.data.ttceDiag.paisCodigo).toBe('160');
    expect(r.data.ttceDiag.intervalosDaNcm[0].paisesOrigem).toEqual(['249']);
  });

  it('erro JSON do Portal vira message + code legível', async () => {
    vi.spyOn(pucomexRepClient, 'isCertConfigured').mockReturnValue(false);
    vi.spyOn(pucomexClient, 'simulateTaImport').mockResolvedValue({
      status: 403, mode: 'live', path: '/talpco',
      data: { message: 'Transação não autorizada para esse perfil', code: 'PUCX-ER0201', extra: 'x' },
    });
    vi.spyOn(pucomexClient, 'ttceChapter').mockResolvedValue({ status: 200, mode: 'live', data: chapterFile(['160']) });
    const r = await (await api('POST', '/api/comex/ncm/tratamentos', { ncmCode: '95069100', country: 'CN' })).json();
    expect(r.data.taError).toBe('Portal HTTP 403: Transação não autorizada para esse perfil (PUCX-ER0201)');
  });
});
