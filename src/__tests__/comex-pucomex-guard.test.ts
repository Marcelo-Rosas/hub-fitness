import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerPucomexRoutes } from '../core/comex/registerPucomexRoutes';
import { explainPfxError, PucomexClient } from '../core/comex/pucomexClient';

const ENV_KEYS = [
  'COMEX_OPERATOR_TOKEN',
  'PUCOMEX_LIVE',
  'PUCOMEX_PROXY_ALLOW_WRITE',
  'PUCOMEX_CERT_PFX_PATH',
  'PUCOMEX_CERT_PASSWORD',
  'PUCOMEX_CERT_THUMBPRINT',
  'PUCOMEX_USE_VECTRA_HUB_CERT',
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  // Sem certificado do Windows store nos testes.
  process.env.PUCOMEX_USE_VECTRA_HUB_CERT = 'false';
});
afterEach(() => {
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

  // PFX descartável (senha "certo") para testar o diagnóstico do certificado.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pucomex-test-'));
  try {
    const key = path.join(tmpDir, 'k.pem');
    const crt = path.join(tmpDir, 'c.pem');
    pfxPath = path.join(tmpDir, 'cert.pfx');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt,
      '-days', '1', '-subj', '/CN=pucomex-test'], { stdio: 'ignore' });
    execFileSync('openssl', ['pkcs12', '-export', '-inkey', key, '-in', crt, '-out', pfxPath,
      '-passout', 'pass:certo'], { stdio: 'ignore' });
  } catch {
    pfxPath = null; // sem openssl no ambiente — testes de PFX são pulados
  }
});
afterAll(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

function goLiveWithPfx(password: string) {
  process.env.PUCOMEX_CERT_PFX_PATH = pfxPath!;
  process.env.PUCOMEX_CERT_PASSWORD = password;
  process.env.PUCOMEX_LIVE = 'true';
}

describe('trava das rotas do certificado PUCOMEX', () => {
  it('DEMO sem COMEX_OPERATOR_TOKEN: rotas travadas dão 503', async () => {
    for (const [m, p] of [['GET', '/api/comex/processes'], ['POST', '/api/comex/pucomex/proxy'], ['GET', '/api/comex/field-defs']]) {
      const res = await fetch(`${baseUrl}${p}`, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: m === 'GET' ? undefined : '{}',
      });
      expect(res.status, p).toBe(503);
      expect((await res.json()).code, p).toBe('COMEX_OPERATOR_TOKEN_UNSET');
    }
  });

  it('rotas públicas passam sem token', async () => {
    expect((await fetch(`${baseUrl}/api/comex/pucomex/catalog`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/comex/pucomex/status`)).status).toBe(200);
  });

  it('token com espaço/CRLF no header e no env é aceito', async () => {
    process.env.COMEX_OPERATOR_TOKEN = ' abc123\r\n';
    const res = await fetch(`${baseUrl}/api/comex/pucomex/catalog`);
    expect(res.status).toBe(200);
    const ok = await post('/api/comex/pucomex/proxy', { path: '/x' }, { 'x-comex-token': 'abc123 ' });
    expect(ok.status).toBe(200);
  });

  it('live sem COMEX_OPERATOR_TOKEN: fail-closed 503', async (ctx) => {
    if (!pfxPath) ctx.skip();
    goLiveWithPfx('certo');
    for (const p of ['/api/comex/pucomex/proxy', '/api/comex/pucomex/authenticate', '/api/comex/duimp/consult']) {
      const res = await post(p, { path: '/x', duimpNumber: '1' });
      expect(res.status, p).toBe(503);
      expect((await res.json()).code).toBe('COMEX_OPERATOR_TOKEN_UNSET');
    }
  });

  it('token configurado: sem header ou header errado → 401', async () => {
    process.env.COMEX_OPERATOR_TOKEN = 'segredo-123';
    process.env.PUCOMEX_LIVE = 'false';
    expect((await post('/api/comex/pucomex/proxy', { path: '/x' })).status).toBe(401);
    expect((await post('/api/comex/pucomex/proxy', { path: '/x' }, { 'x-comex-token': 'errado' })).status).toBe(401);
    const ok = await post('/api/comex/pucomex/proxy', { path: '/x' }, { 'x-comex-token': 'segredo-123' });
    expect(ok.status).toBe(200);
  });

  it('proxy: escrita bloqueada sem opt-in e path absoluto recusado', async () => {
    process.env.COMEX_OPERATOR_TOKEN = 't';
    const h = { 'x-comex-token': 't' };
    expect((await post('/api/comex/pucomex/proxy', { method: 'POST', path: '/duimp/api/ext/duimp' }, h)).status).toBe(403);
    expect((await post('/api/comex/pucomex/proxy', { method: 'PATCH', path: '/x' }, h)).status).toBe(400);
    expect((await post('/api/comex/pucomex/proxy', { path: '//evil.example/x' }, h)).status).toBe(400);
    expect((await post('/api/comex/pucomex/proxy', { path: 'https://evil.example/x' }, h)).status).toBe(400);
    process.env.PUCOMEX_PROXY_ALLOW_WRITE = 'true';
    expect((await post('/api/comex/pucomex/proxy', { method: 'POST', path: '/x' }, h)).status).toBe(200);
  });

  it('authenticate recusa Role-Type fora da lista oficial', async () => {
    process.env.COMEX_OPERATOR_TOKEN = 't';
    const res = await post('/api/comex/pucomex/authenticate', { roleType: 'ADMIN' }, { 'x-comex-token': 't' });
    expect(res.status).toBe(400);
  });
});

describe('diagnóstico do PFX', () => {
  it('senha errada vira certError legível e authenticate não chama o Portal', async (ctx) => {
    if (!pfxPath) ctx.skip();
    goLiveWithPfx('errada');
    const client = new PucomexClient();
    expect(client.getStatus().certError).toMatch(/mac verify failure|senha errada|PFX/i);
    const auth = await client.authenticate();
    expect(auth.success).toBe(false);
    expect(auth.code).toBe('PUCOMEX_CERT_INVALID');
  });

  it('senha certa com espaço/CRLF no secret abre o PFX', (ctx) => {
    if (!pfxPath) ctx.skip();
    goLiveWithPfx('certo \r\n');
    expect(new PucomexClient().getStatus().certError).toBeNull();
  });

  it('explainPfxError traduz mac verify failure', () => {
    expect(explainPfxError('error:11800071:PKCS12 routines::mac verify failure')).toMatch(/senha errada/);
  });
});
