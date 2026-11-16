/**
 * Trava das rotas Comex que usam o certificado ICP-Brasil (mTLS) ou o disco.
 *
 * O login do app ainda é mock (token `mock-jwt:<email>` forjável, repo público),
 * então a sessão do usuário não serve de autorização. A trava é um segredo só
 * do servidor: COMEX_OPERATOR_TOKEN, enviado pelo M18 no header x-comex-token.
 *
 * Fail-closed: com live PUCOMEX ligado e sem COMEX_OPERATOR_TOKEN, as rotas
 * travadas respondem 503. Em DEMO (sem certificado) passam livres — só stubs.
 */

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pucomexClient } from './pucomexClient';

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

/** Exposto em /status para o M18 saber se precisa pedir o token. */
export function comexGuardStatus() {
  const live = pucomexClient.isLiveModeEnabled();
  const token = configuredToken();
  return {
    operatorTokenRequired: live || !!token,
    operatorTokenConfigured: !!token,
  };
}

export function requireComexOperator(req: Request, res: Response, next: NextFunction) {
  const token = configuredToken();
  const live = pucomexClient.isLiveModeEnabled();

  if (!token) {
    if (!live) return next();
    return res.status(503).json({
      success: false,
      code: 'COMEX_OPERATOR_TOKEN_UNSET',
      error:
        'Live PUCOMEX ligado sem COMEX_OPERATOR_TOKEN no servidor — rotas do certificado bloqueadas. Defina o secret ou PUCOMEX_LIVE=false.',
    });
  }

  const sent = String(req.headers[COMEX_TOKEN_HEADER] || '').trim();
  if (!sent || !safeEqual(sent, token)) {
    return res.status(401).json({
      success: false,
      code: 'COMEX_OPERATOR_TOKEN_REQUIRED',
      error: 'Token de operador Comex ausente ou inválido.',
    });
  }
  return next();
}
