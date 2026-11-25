import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  verifyAccessJwt,
  applyAccessIdentity,
  clearJwksCache,
  type JwksFetcher,
} from '../../workers/hub-fitness-proxy/src/accessIdentity';

// Testes do módulo puro de verificação do JWT do Cloudflare Access.
// Gera um par RSA real e assina tokens RS256 com WebCrypto.

const TEAM = 'equipe.cloudflareaccess.com';
const AUD = 'AUD123';
const ISS = `https://${TEAM}`;
const NOW = 1_800_000_000_000; // ms
const NOW_S = Math.floor(NOW / 1000);

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid?: string; alg?: string };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(obj: unknown): string {
  return b64url(enc.encode(JSON.stringify(obj)));
}

async function sign(header: Record<string, unknown>, payload: Record<string, unknown>): Promise<string> {
  const input = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc.encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

function payloadOk(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: 'Op@Exemplo.com',
    aud: [AUD],
    iss: ISS,
    iat: NOW_S - 10,
    nbf: NOW_S - 10,
    exp: NOW_S + 3600,
    ...extra,
  };
}

const headerOk = { alg: 'RS256', kid: 'k1', typ: 'JWT' };

function fetcherWith(keys: JsonWebKey[]) {
  return vi.fn<JwksFetcher>(async () => ({ keys }));
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  privateKey = pair.privateKey;
  publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' } as JsonWebKey & {
    kid: string;
  };
});

beforeEach(() => {
  clearJwksCache();
});

describe('verifyAccessJwt', () => {
  it('válido → e-mail em minúsculas', async () => {
    const token = await sign(headerOk, payloadOk());
    const fetchJwks = fetcherWith([publicJwk]);
    const email = await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW, fetchJwks });
    expect(email).toBe('op@exemplo.com');
  });

  it('aceita aud como string', async () => {
    const token = await sign(headerOk, payloadOk({ aud: AUD }));
    const email = await verifyAccessJwt(token, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBe('op@exemplo.com');
  });

  it('fetcher recebe a URL de certs da equipe', async () => {
    const token = await sign(headerOk, payloadOk());
    const fetchJwks = fetcherWith([publicJwk]);
    await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW, fetchJwks });
    expect(fetchJwks).toHaveBeenCalledWith('https://equipe.cloudflareaccess.com/cdn-cgi/access/certs');
  });

  it('aud diferente → null', async () => {
    const token = await sign(headerOk, payloadOk({ aud: ['OUTRO'] }));
    const email = await verifyAccessJwt(token, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('iss de outra equipe → null', async () => {
    const token = await sign(headerOk, payloadOk({ iss: 'https://outra.cloudflareaccess.com' }));
    const email = await verifyAccessJwt(token, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('exp no passado → null', async () => {
    const token = await sign(headerOk, payloadOk({ exp: NOW_S - 1 }));
    const email = await verifyAccessJwt(token, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('nbf no futuro → null', async () => {
    const token = await sign(headerOk, payloadOk({ nbf: NOW_S + 600 }));
    const email = await verifyAccessJwt(token, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('assinatura adulterada (payload trocado) → null', async () => {
    const token = await sign(headerOk, payloadOk());
    const [h, , s] = token.split('.');
    const forjado = `${h}.${b64urlJson(payloadOk({ email: 'intruso@exemplo.com' }))}.${s}`;
    const email = await verifyAccessJwt(forjado, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('alg diferente de RS256 no header → null', async () => {
    const token = await sign({ ...headerOk, alg: 'HS256' }, payloadOk());
    const email = await verifyAccessJwt(token, {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('kid desconhecido: 1º fetch sem a chave, 2º com → válido; fetchJwks chamado 2x', async () => {
    const token = await sign(headerOk, payloadOk());
    const outraChave = { ...publicJwk, kid: 'k0' };
    const fetchJwks = vi
      .fn<JwksFetcher>()
      .mockResolvedValueOnce({ keys: [outraChave] })
      .mockResolvedValueOnce({ keys: [outraChave, publicJwk] });
    const email = await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW, fetchJwks });
    expect(email).toBe('op@exemplo.com');
    expect(fetchJwks).toHaveBeenCalledTimes(2);
  });

  it('usa o cache: segunda verificação não refaz o fetch', async () => {
    const token = await sign(headerOk, payloadOk());
    const fetchJwks = fetcherWith([publicJwk]);
    await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW, fetchJwks });
    const email = await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW, fetchJwks });
    expect(email).toBe('op@exemplo.com');
    expect(fetchJwks).toHaveBeenCalledTimes(1);
  });

  it("token malformado ('abc') → null", async () => {
    const email = await verifyAccessJwt('abc', {
      teamDomain: TEAM,
      aud: AUD,
      now: NOW,
      fetchJwks: fetcherWith([publicJwk]),
    });
    expect(email).toBeNull();
  });

  it('fetchJwks lança → null', async () => {
    const token = await sign(headerOk, payloadOk());
    const fetchJwks = vi.fn<JwksFetcher>(async () => {
      throw new Error('rede caiu');
    });
    const email = await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW, fetchJwks });
    expect(email).toBeNull();
  });

  it('fetcher padrão: resposta não-ok (ex.: 503) → null, mesmo com corpo JSON de chaves', async () => {
    const token = await sign(headerOk, payloadOk());
    const fetchGlobal = vi.fn(
      async () =>
        new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchGlobal);
    try {
      const email = await verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, now: NOW });
      expect(email).toBeNull();
      expect(fetchGlobal).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('applyAccessIdentity', () => {
  const ENV = { CF_ACCESS_TEAM_DOMAIN: TEAM, CF_ACCESS_AUD: AUD };

  it('remove x-hub-access-email forjado quando não há JWT (e não chama verify)', async () => {
    const incoming = new Headers({ 'x-hub-access-email': 'forjado@x.com' });
    const upstream = new Headers({ 'x-hub-access-email': 'forjado@x.com' });
    const verify = vi.fn(async () => 'op@exemplo.com');
    await applyAccessIdentity(incoming, upstream, ENV, verify);
    expect(upstream.has('x-hub-access-email')).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it('env sem CF_ACCESS_AUD → não chama verify, header ausente', async () => {
    const incoming = new Headers({ 'cf-access-jwt-assertion': 'tok' });
    const upstream = new Headers({ 'x-hub-access-email': 'forjado@x.com' });
    const verify = vi.fn(async () => 'op@exemplo.com');
    await applyAccessIdentity(incoming, upstream, { CF_ACCESS_TEAM_DOMAIN: TEAM }, verify);
    expect(verify).not.toHaveBeenCalled();
    expect(upstream.has('x-hub-access-email')).toBe(false);
  });

  it('env sem CF_ACCESS_TEAM_DOMAIN → não chama verify, header ausente', async () => {
    const incoming = new Headers({ 'cf-access-jwt-assertion': 'tok' });
    const upstream = new Headers();
    const verify = vi.fn(async () => 'op@exemplo.com');
    await applyAccessIdentity(incoming, upstream, { CF_ACCESS_AUD: AUD }, verify);
    expect(verify).not.toHaveBeenCalled();
    expect(upstream.has('x-hub-access-email')).toBe(false);
  });

  it('JWT válido → upstream recebe x-hub-access-email', async () => {
    const incoming = new Headers({ 'Cf-Access-Jwt-Assertion': 'tok' });
    const upstream = new Headers({ 'x-hub-access-email': 'forjado@x.com' });
    const verify = vi.fn(async () => 'op@exemplo.com');
    await applyAccessIdentity(incoming, upstream, ENV, verify);
    expect(upstream.get('x-hub-access-email')).toBe('op@exemplo.com');
    expect(verify).toHaveBeenCalledWith('tok', { teamDomain: TEAM, aud: AUD });
  });

  it('verify → null → header ausente', async () => {
    const incoming = new Headers({ 'cf-access-jwt-assertion': 'tok' });
    const upstream = new Headers({ 'x-hub-access-email': 'forjado@x.com' });
    const verify = vi.fn(async () => null);
    await applyAccessIdentity(incoming, upstream, ENV, verify);
    expect(upstream.has('x-hub-access-email')).toBe(false);
  });

  it('normaliza CF_ACCESS_TEAM_DOMAIN (trim, remove https:// e barra final, minúsculas)', async () => {
    const incoming = new Headers({ 'cf-access-jwt-assertion': 'tok' });
    const upstream = new Headers();
    const verify = vi.fn(async () => 'op@exemplo.com');
    await applyAccessIdentity(
      incoming,
      upstream,
      { CF_ACCESS_TEAM_DOMAIN: ' HTTPS://Equipe.CloudflareAccess.com/ ', CF_ACCESS_AUD: AUD },
      verify,
    );
    expect(verify).toHaveBeenCalledWith('tok', { teamDomain: 'equipe.cloudflareaccess.com', aud: AUD });
  });
});
