/**
 * Token de operador Comex (header x-comex-token) — guardado no localStorage
 * deste navegador (persiste entre abas/visitas; antes era sessionStorage e o
 * painel voltava a cada entrada). Exigido pelas rotas /api/comex (exceto
 * status/catalog/benchmark/stats).
 */

const KEY = 'hub.comex.operatorToken';

export function getComexOperatorToken(): string {
  try {
    const persisted = (localStorage.getItem(KEY) || '').trim();
    if (persisted) return persisted;
    // Migração: token salvo pela versão antiga (sessionStorage).
    const legacy = (sessionStorage.getItem(KEY) || '').trim();
    if (legacy) {
      localStorage.setItem(KEY, legacy);
      sessionStorage.removeItem(KEY);
    }
    return legacy;
  } catch {
    return '';
  }
}

export function setComexOperatorToken(token: string): void {
  const clean = token.trim();
  try {
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage bloqueado — token vale só até recarregar */
  }
}

/** 32 bytes aleatórios -> 64 caracteres hex. */
export function generateOperatorToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Formato aceito para o token (também evita problemas de aspas no PowerShell). */
export const OPERATOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

export function isValidOperatorTokenFormat(token: string): boolean {
  return OPERATOR_TOKEN_PATTERN.test(token.trim());
}

/**
 * Comando PowerShell (rodar na raiz do repo) para gravar o secret no Worker.
 * O token NÃO vai no comando: é lido da área de transferência.
 */
export function buildWranglerSecretCommand(): string {
  return 'cd workers\\hub-fitness-proxy; Get-Clipboard | npx.cmd wrangler secret put COMEX_OPERATOR_TOKEN';
}

/** fetch para /api/comex/* com x-comex-token; JSON content-type só se body for string. */
export function comexFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getComexOperatorToken();
  if (token) headers.set('x-comex-token', token);
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...init, headers });
}

/** true se a resposta é a recusa do gateway por token (401/503 com code de token). */
export async function isComexTokenRejection(res: Response): Promise<boolean> {
  if (res.status !== 401 && res.status !== 503) return false;
  try {
    const json = await res.clone().json();
    return json?.code === 'COMEX_OPERATOR_TOKEN_REQUIRED' || json?.code === 'COMEX_OPERATOR_TOKEN_UNSET';
  } catch {
    return false;
  }
}

/** Busca o arquivo do documento autenticado e abre em nova aba. */
export async function openComexDocument(docId: string): Promise<void> {
  const res = await comexFetch(`/api/comex/documents/${encodeURIComponent(docId)}/file`);
  if (!res.ok) throw new Error(`Falha ao abrir documento (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
