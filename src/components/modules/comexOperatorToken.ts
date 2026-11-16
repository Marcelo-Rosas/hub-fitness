/**
 * Token de operador Comex (header x-comex-token) — guardado só na aba
 * (sessionStorage). Exigido pelas rotas que usam o certificado ICP-Brasil.
 */

const KEY = 'hub.comex.operatorToken';

export function getComexOperatorToken(): string {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setComexOperatorToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage bloqueado — token vale só até recarregar */
  }
}

/** Headers para rotas travadas (JSON por padrão). */
export function comexOperatorHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getComexOperatorToken();
  return { 'Content-Type': 'application/json', ...extra, ...(token ? { 'x-comex-token': token } : {}) };
}
