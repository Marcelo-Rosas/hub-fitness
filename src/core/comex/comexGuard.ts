/**
 * Trava das rotas Comex que usam o certificado ICP-Brasil (mTLS) ou o disco.
 *
 * O login do app ainda é mock (token `mock-jwt:<email>` forjável, repo público),
 * então a sessão do usuário não serve de autorização. Duas formas aceitas:
 *
 * 1. Identidade do Cloudflare Access: o Worker valida o login do Access e envia
 *    ao container o header confiável x-hub-access-email (e-mail em minúsculas),
 *    sempre removendo a cópia vinda do cliente. Autoriza se o e-mail estiver em
 *    COMEX_ALLOWED_EMAILS (lista separada por vírgula). O header só é aceito com
 *    HUB_TRUST_ACCESS_HEADER='true' (var injetada só pelo Worker): sem ela — dev
 *    local, Express em 0.0.0.0 — qualquer um na rede poderia forjar o header.
 * 2. Segredo do servidor: COMEX_OPERATOR_TOKEN, enviado pelo M18 no header
 *    x-comex-token.
 *
 * Fail-closed estrito: sem COMEX_ALLOWED_EMAILS nem COMEX_OPERATOR_TOKEN no
 * servidor, tudo em /api/comex (exceto rotas públicas) responde 503 — inclusive
 * em DEMO.
 */

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const COMEX_TOKEN_HEADER = 'x-comex-token';
/** Header setado pelo Cloudflare Worker após validar o Access (nunca vindo do cliente). */
export const ACCESS_EMAIL_HEADER = 'x-hub-access-email';

export type ComexAuthVia = 'access' | 'token';

function configuredToken(): string | null {
  const t = process.env.COMEX_OPERATOR_TOKEN?.trim();
  return t ? t : null;
}

/**
 * Lista normalizada (trim + minúsculas) de COMEX_ALLOWED_EMAILS — vazia se o
 * container não confia no header do Access (HUB_TRUST_ACCESS_HEADER !== 'true').
 * Assim a lista só conta como "configurada" (503 vs 401) quando a flag existe.
 */
function allowedEmails(): string[] {
  if (process.env.HUB_TRUST_ACCESS_HEADER !== 'true') return [];
  return String(process.env.COMEX_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Como o request está autorizado: e-mail do Access primeiro, depois token; null se nenhum. */
export function comexAuthVia(req: Pick<Request, 'headers'>): ComexAuthVia | null {
  const emails = allowedEmails();
  if (emails.length) {
    const email = String(req.headers[ACCESS_EMAIL_HEADER] || '').trim().toLowerCase();
    if (email && emails.includes(email)) return 'access';
  }

  const token = configuredToken();
  if (token) {
    const sent = String(req.headers[COMEX_TOKEN_HEADER] || '').trim();
    if (sent && safeEqual(sent, token)) return 'token';
  }
  return null;
}

/**
 * Exposto em /status para o M18 saber como está a trava e se o request atual
 * está autorizado. Nunca devolve a lista de e-mails.
 */
export function comexGuardStatus(req: Pick<Request, 'headers'>) {
  const via = comexAuthVia(req);
  return {
    operatorTokenRequired: true as const,
    operatorTokenConfigured: !!configuredToken(),
    accessEmailConfigured: allowedEmails().length > 0,
    authorized: via !== null,
    via,
  };
}

/** Verificação pura: request autorizado por e-mail do Access ou por token. */
export function isValidComexOperatorToken(req: Pick<Request, 'headers'>): boolean {
  return comexAuthVia(req) !== null;
}

/**
 * Estrito: sem COMEX_ALLOWED_EMAILS (com HUB_TRUST_ACCESS_HEADER='true') nem
 * COMEX_OPERATOR_TOKEN no servidor → 503
 * (mesmo em DEMO); sem identidade autorizada nem token válido → 401.
 */
export function requireComexOperatorStrict(req: Request, res: Response, next: NextFunction): void {
  if (!configuredToken() && allowedEmails().length === 0) {
    res.status(503).json({
      success: false,
      code: 'COMEX_OPERATOR_TOKEN_UNSET',
      error:
        'Nem COMEX_ALLOWED_EMAILS nem COMEX_OPERATOR_TOKEN configurados no servidor — M18 Comex bloqueado. Defina um dos dois para usar o módulo.',
    });
    return;
  }

  if (comexAuthVia(req) === null) {
    res.status(401).json({
      success: false,
      code: 'COMEX_OPERATOR_TOKEN_REQUIRED',
      error: 'Acesso Comex não autorizado: e-mail fora da lista ou token de operador ausente/inválido.',
    });
    return;
  }
  next();
}

/** Únicas rotas /api/comex liberadas sem token (diagnóstico, catálogo estático, dados públicos ComexStat). */
export const COMEX_PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'GET', path: '/api/comex/pucomex/status' },
  { method: 'GET', path: '/api/comex/pucomex/catalog' },
  { method: 'POST', path: '/api/comex/benchmark' },
  { method: 'POST', path: '/api/comex/stats/monthly' },
];

/** Montar com app.use('/api/comex', comexGateway): baseUrl + path = caminho completo. */
export function comexGateway(req: Request, res: Response, next: NextFunction): void {
  const full = (req.baseUrl + req.path).replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  if (COMEX_PUBLIC_ROUTES.some((r) => r.method === method && r.path === full)) {
    next();
    return;
  }
  requireComexOperatorStrict(req, res, next);
}
