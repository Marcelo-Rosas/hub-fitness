// Verificação do JWT do Cloudflare Access (header Cf-Access-Jwt-Assertion).
// Módulo puro: roda no runtime de Workers e em Node 20+ (testes), usando só
// WebCrypto (globalThis.crypto.subtle), atob/TextEncoder e fetch. Sem imports de Node.
//
// Contrato: verifyAccessJwt devolve o e-mail (minúsculo) de quem logou no Access,
// ou null se o token for inválido por QUALQUER motivo. Nunca lança.

export type JwksFetcher = (url: string) => Promise<{ keys: JsonWebKey[] }>;

export interface VerifyAccessJwtOptions {
  /** Domínio da equipe, ex.: 'equipe.cloudflareaccess.com' (sem https://). */
  teamDomain: string;
  /** Application Audience (AUD) tag da aplicação no Access. */
  aud: string;
  /** Relógio injetável em ms (testes). Padrão: Date.now(). */
  now?: number;
  /** Busca do JWKS injetável (testes). Padrão: fetch(url).then(r => r.json()). */
  fetchJwks?: JwksFetcher;
}

type JwkComKid = JsonWebKey & { kid?: string };

interface EntradaCache {
  keys: JwkComKid[];
  buscadoEm: number; // ms
}

const TTL_CACHE_MS = 60 * 60 * 1000; // 1 h
const cacheJwks = new Map<string, EntradaCache>();

/** Limpa o cache de JWKS (usado pelos testes). */
export function clearJwksCache(): void {
  cacheJwks.clear();
}

const fetcherPadrao: JwksFetcher = (url) =>
  fetch(url).then((r) => r.json() as Promise<{ keys: JsonWebKey[] }>);

function base64UrlParaBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('base64url inválido');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlParaJson(s: string): Record<string, unknown> {
  const json = new TextDecoder().decode(base64UrlParaBytes(s));
  const obj: unknown = JSON.parse(json);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON não é objeto');
  return obj as Record<string, unknown>;
}

async function buscarChaves(
  teamDomain: string,
  fetchJwks: JwksFetcher,
  nowMs: number,
): Promise<JwkComKid[]> {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetchJwks(url);
  const keys = Array.isArray(res?.keys) ? (res.keys as JwkComKid[]) : [];
  cacheJwks.set(teamDomain, { keys, buscadoEm: nowMs });
  return keys;
}

async function acharChave(
  kid: string,
  teamDomain: string,
  fetchJwks: JwksFetcher,
  nowMs: number,
): Promise<JwkComKid | null> {
  const emCache = cacheJwks.get(teamDomain);
  let keys: JwkComKid[];
  if (emCache && nowMs - emCache.buscadoEm < TTL_CACHE_MS) {
    keys = emCache.keys;
  } else {
    keys = await buscarChaves(teamDomain, fetchJwks, nowMs);
  }
  let chave = keys.find((k) => k.kid === kid) ?? null;
  if (!chave) {
    // Rotação de chave: refaz a busca UMA vez antes de desistir.
    keys = await buscarChaves(teamDomain, fetchJwks, nowMs);
    chave = keys.find((k) => k.kid === kid) ?? null;
  }
  return chave;
}

export async function verifyAccessJwt(
  token: string,
  opts: VerifyAccessJwtOptions,
): Promise<string | null> {
  try {
    if (typeof token !== 'string') return null;
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const [hB64, pB64, sB64] = partes;

    const header = base64UrlParaJson(hB64);
    if (header.alg !== 'RS256') return null;
    const kid = header.kid;
    if (typeof kid !== 'string' || !kid) return null;

    const payload = base64UrlParaJson(pB64);
    const assinatura = base64UrlParaBytes(sB64);

    const nowMs = opts.now ?? Date.now();
    const fetchJwks = opts.fetchJwks ?? fetcherPadrao;

    const jwk = await acharChave(kid, opts.teamDomain, fetchJwks, nowMs);
    if (!jwk) return null;

    const chave = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      chave,
      assinatura,
      new TextEncoder().encode(`${hB64}.${pB64}`),
    );
    if (!ok) return null;

    // Claims
    if (payload.iss !== `https://${opts.teamDomain}`) return null;

    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(opts.aud) : aud === opts.aud;
    if (!audOk) return null;

    const nowS = nowMs / 1000;
    if (typeof payload.exp !== 'number' || payload.exp <= nowS) return null;
    if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > nowS)) return null;

    const email = payload.email;
    if (typeof email !== 'string' || !email) return null;
    return email.toLowerCase();
  } catch {
    return null;
  }
}

/** Header que o container (gateway comex) usa como identidade de quem logou no Access. */
export const ACCESS_EMAIL_HEADER = 'x-hub-access-email';

export interface AccessIdentityEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

/** 'https://equipe.cloudflareaccess.com/' → 'equipe.cloudflareaccess.com'. */
function normalizarTeamDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/**
 * Repassa ao container o e-mail verificado do Access em `x-hub-access-email`.
 * Sempre remove primeiro qualquer cópia vinda do cliente (anti-spoof). Só seta o
 * header se o JWT de `Cf-Access-Jwt-Assertion` for válido para a equipe/AUD do env.
 */
export async function applyAccessIdentity(
  incoming: Headers,
  upstream: Headers,
  env: AccessIdentityEnv,
  verify: (token: string, opts: VerifyAccessJwtOptions) => Promise<string | null> = verifyAccessJwt,
): Promise<void> {
  upstream.delete(ACCESS_EMAIL_HEADER);

  const token = incoming.get('cf-access-jwt-assertion');
  if (!token) return;

  const teamDomain = normalizarTeamDomain(env.CF_ACCESS_TEAM_DOMAIN ?? '');
  const aud = (env.CF_ACCESS_AUD ?? '').trim();
  if (!teamDomain || !aud) return;

  const email = await verify(token, { teamDomain, aud });
  if (email) upstream.set(ACCESS_EMAIL_HEADER, email);
}
