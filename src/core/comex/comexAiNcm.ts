import type { Request } from 'express';
import { isValidComexOperatorToken } from './comexGuard';

/**
 * Consulta NCM no Portal Único só quando a requisição traz x-comex-token válido.
 * Sem token válido devolve null (a rota segue só com o Gemini/fallback).
 */
export async function fetchPortalNcmIfAuthorized(
  req: Pick<Request, 'headers'>,
  ncmCode: string,
  client: { consultNcm: (ncm: string) => Promise<{ data?: unknown; status?: number }> },
): Promise<unknown> {
  if (!isValidComexOperatorToken(req)) return null;
  try {
    const res = await client.consultNcm(ncmCode);
    if (typeof res.status === 'number' && res.status >= 400) return null;
    return res.data ?? null;
  } catch {
    return null;
  }
}
