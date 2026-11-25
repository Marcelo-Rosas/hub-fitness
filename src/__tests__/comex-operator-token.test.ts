import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateOperatorToken,
  buildWranglerSecretCommand,
  isValidOperatorTokenFormat,
  setComexOperatorToken,
  getComexOperatorToken,
  comexFetch,
  isComexTokenRejection,
  OPERATOR_TOKEN_TTL_MS,
} from '../components/modules/comexOperatorToken';

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

function stubStorage() {
  (globalThis as any).localStorage = makeStorage();
  (globalThis as any).sessionStorage = makeStorage();
}

describe('comexOperatorToken', () => {
  beforeEach(() => stubStorage());
  afterEach(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).sessionStorage;
    vi.restoreAllMocks();
  });

  it('token sobrevive a nova aba (localStorage, não sessionStorage)', () => {
    setComexOperatorToken('abc_DEF-1234567890');
    (globalThis as any).sessionStorage = makeStorage(); // aba nova
    expect(getComexOperatorToken()).toBe('abc_DEF-1234567890');
  });

  it('migra token antigo do sessionStorage para o localStorage', () => {
    (globalThis as any).sessionStorage.setItem('hub.comex.operatorToken', 'legacy_token_123456');
    expect(getComexOperatorToken()).toBe('legacy_token_123456');
    expect((globalThis as any).localStorage.getItem('hub.comex.operatorToken')).toBe('legacy_token_123456');
  });

  it('setComexOperatorToken vazio apaga dos dois storages', () => {
    setComexOperatorToken('abc_DEF-1234567890');
    (globalThis as any).sessionStorage.setItem('hub.comex.operatorToken', 'x');
    setComexOperatorToken('');
    expect(getComexOperatorToken()).toBe('');
  });

  it('token expira 30 dias depois de salvo', () => {
    const t0 = 1_700_000_000_000;
    setComexOperatorToken('abc_DEF-1234567890', t0);
    expect(getComexOperatorToken(t0 + OPERATOR_TOKEN_TTL_MS)).toBe('abc_DEF-1234567890');
    expect(getComexOperatorToken(t0 + OPERATOR_TOKEN_TTL_MS + 1)).toBe('');
    expect((globalThis as any).localStorage.getItem('hub.comex.operatorToken')).toBeNull();
  });

  it('token antigo sem data começa a contar a expiração na leitura', () => {
    (globalThis as any).localStorage.setItem('hub.comex.operatorToken', 'old_token_1234567890');
    const t0 = 1_700_000_000_000;
    expect(getComexOperatorToken(t0)).toBe('old_token_1234567890');
    expect(getComexOperatorToken(t0 + OPERATOR_TOKEN_TTL_MS + 1)).toBe('');
  });

  it('migração: localStorage.setItem lançando ainda devolve o token do sessionStorage', () => {
    (globalThis as any).sessionStorage.setItem('hub.comex.operatorToken', 'legacy_token_123456');
    (globalThis as any).localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(getComexOperatorToken()).toBe('legacy_token_123456');
  });

  it('gera 64 hex e nunca repete', () => {
    const a = generateOperatorToken();
    const b = generateOperatorToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('comando wrangler entra na pasta do worker e lê o token do clipboard', () => {
    expect(buildWranglerSecretCommand()).toBe(
      'cd workers\\hub-fitness-proxy; Get-Clipboard | npx.cmd wrangler secret put COMEX_OPERATOR_TOKEN',
    );
  });

  it('valida formato do token', () => {
    expect(isValidOperatorTokenFormat(generateOperatorToken())).toBe(true);
    expect(isValidOperatorTokenFormat('abc_DEF-1234567890')).toBe(true);
    expect(isValidOperatorTokenFormat('curto')).toBe(false);
    expect(isValidOperatorTokenFormat("abcdefghijklmnop'; rm")).toBe(false);
    expect(isValidOperatorTokenFormat('com espaco 1234567890')).toBe(false);
  });

  it('setComexOperatorToken faz trim', () => {
    setComexOperatorToken(' x \r\n');
    expect(getComexOperatorToken()).toBe('x');
  });

  it('comexFetch envia token e JSON só para body string', async () => {
    setComexOperatorToken('tok');
    const spy = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', spy);
    await comexFetch('/api/comex/x', { method: 'POST', body: '{"a":1}' });
    const h1 = new Headers(spy.mock.calls[0][1].headers);
    expect(h1.get('x-comex-token')).toBe('tok');
    expect(h1.get('content-type')).toBe('application/json');

    await comexFetch('/api/comex/y', {
      method: 'POST',
      body: new Uint8Array([1]),
      headers: { 'Content-Type': 'application/pdf' },
    });
    const h2 = new Headers(spy.mock.calls[1][1].headers);
    expect(h2.get('content-type')).toBe('application/pdf');
    vi.unstubAllGlobals();
  });

  it('isComexTokenRejection reconhece 401/503 com code de token', async () => {
    const mk = (status: number, code: string) =>
      new Response(JSON.stringify({ code }), { status });
    expect(await isComexTokenRejection(mk(401, 'COMEX_OPERATOR_TOKEN_REQUIRED'))).toBe(true);
    expect(await isComexTokenRejection(mk(503, 'COMEX_OPERATOR_TOKEN_UNSET'))).toBe(true);
    expect(await isComexTokenRejection(mk(401, 'OUTRO'))).toBe(false);
    expect(await isComexTokenRejection(mk(200, 'COMEX_OPERATOR_TOKEN_REQUIRED'))).toBe(false);
  });
});
