import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateOperatorToken,
  buildWranglerSecretCommand,
  isValidOperatorTokenFormat,
  setComexOperatorToken,
  getComexOperatorToken,
  comexFetch,
  isComexTokenRejection,
} from '../components/modules/comexOperatorToken';

function stubStorage() {
  const store = new Map<string, string>();
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

describe('comexOperatorToken', () => {
  beforeEach(() => stubStorage());
  afterEach(() => {
    delete (globalThis as any).sessionStorage;
    vi.restoreAllMocks();
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
