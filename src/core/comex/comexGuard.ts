/**
 * Trava das rotas Comex que usam o certificado ICP-Brasil (mTLS) ou o disco.
 *
 * O login do app ainda é mock (token `mock-jwt:<email>` forjável, repo público),
 * então a sessão do usuário não serve de autorização. A trava é um segredo só
 * do servidor: COMEX_OPERATOR_TOKEN, enviado pelo M18 no header x-comex-token.
 *
 * Fail-closed estrito: sem COMEX_OPERATOR_TOKEN no servidor, tudo em /api/comex
 * (exceto rotas públicas) responde 503 — inclusive em DEMO.
 */

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const COMEX_TOKEN_HEADER = 'x-comex-token';

function configuredToken(): string | null {
  const t = process.env.COMEX_OPERATOR_TOKEN?.trim();
  return t ? t : null;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Exposto em /status para o M18 saber que o token é sempre exigido. */
export function comexGuardStatus() {
  return {
    operatorTokenRequired: true,
    operatorTokenConfigured: !!configuredToken(),
  };
}

/** Verificação pura: há token configurado no servidor e o header bate. */
export function isValidComexOperatorToken(req: Pick<Request, 'headers'>): boolean {
  const token = configuredToken();
  if (!token) return false;
  const sent = String(req.headers[COMEX_TOKEN_HEADER] || '').trim();
  return !!sent && safeEqual(sent, token);
}

/**
 * Estrito: sem COMEX_OPERATOR_TOKEN no servidor → 503 (mesmo em DEMO);
 * sem header ou header errado → 401.
 */
export function requireComexOperatorStrict(req: Request, res: Response, next: NextFunction): void {
  const token = configuredToken();
  if (!token) {
    res.status(503).json({
      success: false,
      code: 'COMEX_OPERATOR_TOKEN_UNSET',
      error:
        'COMEX_OPERATOR_TOKEN não configurado no servidor — M18 Comex bloqueado. Defina o secret para usar o módulo.',
    });
    return;
  }

  const sent = String(req.headers[COMEX_TOKEN_HEADER] || '').trim();
  if (!sent || !safeEqual(sent, token)) {
    res.status(401).json({
      success: false,
      code: 'COMEX_OPERATOR_TOKEN_REQUIRED',
      error: 'Token de operador Comex ausente ou inválido.',
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
