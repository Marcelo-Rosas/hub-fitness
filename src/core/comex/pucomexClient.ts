/**
 * Cliente PUCOMEX — mTLS A1 via:
 * 1) PFX em disco (exportável), ou
 * 2) Thumbprint no Windows CurrentUser\My (não exportável — caso VECTRA HUB)
 * Sessão JWT/CSRF: https://docs.portalunico.siscomex.gov.br/introducao-api-publica/
 */

import { X509Certificate } from 'crypto';
import fs from 'fs';
import https from 'https';
import tls from 'tls';
import path from 'path';
import { spawn } from 'child_process';
import { URL } from 'url';
import {
  DEFAULT_PUCOMEX_ROLE,
  PUCOMEX_CSRF_TTL_MS,
  PUCOMEX_ENVIRONMENTS,
  PUCOMEX_MIN_AUTH_INTERVAL_MS,
  type PucomexEnvironmentId,
  type PucomexRoleType,
} from './environments';
import { fillPathTemplate } from './endpoints';
import { getNcmTable, lookupNcm, NCM_TABLE_PATH } from './ncmTable';

// process.cwd() — esbuild CJS zera import.meta.url; script fica fora do bundle.
const WINDOWS_CERT_SCRIPT = path.join(
  process.cwd(),
  'src/core/comex/windowsCertRequest.ps1',
);

/** VECTRA HUB LTDA A1 — CurrentUser\My (não exportável) */
export const VECTRA_HUB_CERT_THUMBPRINT_DEFAULT = '73AD1B836553434CCA2E753F6866ADC9BE629458';
export const VECTRA_HUB_CNPJ_LABEL_DEFAULT = 'VECTRA HUB LTDA:62.188.748/0001-17';

export interface PucomexSessionTokens {
  authorization: string;
  csrfToken: string;
  csrfExpirationMs: number;
  roleType: PucomexRoleType;
  environment: PucomexEnvironmentId;
  authenticatedAt: string;
  mode: 'live' | 'demo';
}

/**
 * Perfil de credencial:
 * - empresa: e-CNPJ VECTRA HUB (PUCOMEX_CERT_*, PUCOMEX_ROLE_TYPE; fallback Windows store)
 * - representante: e-CPF do representante do importador (PUCOMEX_REP_CERT_*,
 *   PUCOMEX_REP_ROLE_TYPE, padrão IMPEXP — só aceita e-CPF; sem fallback Windows)
 */
export type PucomexProfile = 'empresa' | 'representante';

export interface PucomexClientStatus {
  profile: PucomexProfile;
  certConfigured: boolean;
  certPath: string | null;
  certThumbprint: string | null;
  certSource: 'pfx' | 'windows-store' | null;
  /** Erro ao abrir o PFX com a senha (ex.: "mac verify failure"); null = ok ou não-PFX */
  certError: string | null;
  /** Titular (CN) do certificado PFX, quando abre; null caso contrário. */
  certSubject: string | null;
  /** Validade (ISO) do certificado PFX, quando abre. */
  certValidTo: string | null;
  liveModeEnabled: boolean;
  environment: PucomexEnvironmentId;
  baseUrl: string;
  roleType: PucomexRoleType;
  sessionActive: boolean;
  sessionMode: 'live' | 'demo' | null;
  csrfExpiresAt: string | null;
  lastAuthAt: string | null;
  minAuthIntervalMs: number;
  docsHome: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RawResponse {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson: unknown;
}

function headerGet(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function parseBodyJson(bodyText: string): unknown {
  try {
    return bodyText ? JSON.parse(bodyText) : null;
  } catch {
    return bodyText;
  }
}

/** Traduz erros do OpenSSL ao abrir PFX para algo acionável. */
export function explainPfxError(message: string, passwordEnv = 'PUCOMEX_CERT_PASSWORD'): string {
  if (/mac verify failure/i.test(message)) {
    return `PFX não abre com ${passwordEnv} (mac verify failure): senha errada ou arquivo .pfx corrompido (base64 remontado com erro). ${message}`;
  }
  if (/unsupported/i.test(message)) {
    return `PFX com algoritmo legado (RC2/3DES) não suportado pelo OpenSSL 3 — reexporte o certificado com AES-256. ${message}`;
  }
  return `PFX inválido: ${message}`;
}

export class PucomexClient {
  private session: PucomexSessionTokens | null = null;
  private lastAuthAttemptMs = 0;
  private pfxAgent: https.Agent | null = null;
  private pfxAgentKey = '';
  private certCheck: {
    key: string;
    error: string | null;
    subject: string | null;
    validTo: string | null;
  } | null = null;
  private inflightAuth: Promise<Awaited<ReturnType<PucomexClient['authenticate']>>> | null = null;

  constructor(readonly profile: PucomexProfile = 'empresa') {}

  /** Nome da env do perfil: PUCOMEX_<X> (empresa) ou PUCOMEX_REP_<X> (representante). */
  private envName(suffix: 'CERT_PFX_PATH' | 'CERT_PASSWORD' | 'ROLE_TYPE'): string {
    return this.profile === 'representante' ? `PUCOMEX_REP_${suffix}` : `PUCOMEX_${suffix}`;
  }

  private env(suffix: 'CERT_PFX_PATH' | 'CERT_PASSWORD' | 'ROLE_TYPE'): string | undefined {
    return process.env[this.envName(suffix)];
  }

  /** Senha sem espaço/CRLF acidental do secret. */
  private getCertPassword(): string {
    return (this.env('CERT_PASSWORD') ?? '').trim();
  }

  /** Titular (CN) e validade do PFX — só depois de getCertError() abrir o arquivo. */
  private getCertInfo(): { subject: string | null; validTo: string | null } {
    if (this.getCertError() !== null || !this.certCheck) return { subject: null, validTo: null };
    return { subject: this.certCheck.subject, validTo: this.certCheck.validTo };
  }

  /**
   * Abre o PFX com a senha uma vez (cache por path+mtime+senha) e devolve o erro,
   * se houver. Mostra o problema no /status em vez de falhar só no handshake.
   */
  getCertError(): string | null {
    if (this.getCertSource() !== 'pfx') return null;
    const certPath = this.getCertPath()!;
    let key: string;
    try {
      const st = fs.statSync(certPath);
      key = `${certPath}|${st.mtimeMs}|${st.size}|${this.getCertPassword()}`;
    } catch (err) {
      return `PFX ilegível: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (this.certCheck?.key === key) return this.certCheck.error;
    let error: string | null = null;
    let subject: string | null = null;
    let validTo: string | null = null;
    try {
      const ctx = tls.createSecureContext({ pfx: fs.readFileSync(certPath), passphrase: this.getCertPassword() });
      try {
        // API interna do Node (SecureContext.getCertificate → DER); só informativo.
        const der = (ctx as unknown as { context?: { getCertificate?: () => Buffer | null } }).context?.getCertificate?.();
        if (der) {
          const x = new X509Certificate(der);
          subject = /(?:^|\n)CN=([^\n]+)/.exec(x.subject)?.[1] ?? x.subject;
          validTo = new Date(x.validTo).toISOString();
        }
      } catch {
        /* titular/validade indisponíveis — não é erro do PFX */
      }
    } catch (err) {
      error = explainPfxError(err instanceof Error ? err.message : String(err), this.envName('CERT_PASSWORD'));
    }
    this.certCheck = { key, error, subject, validTo };
    return error;
  }

  getEnvironmentId(): PucomexEnvironmentId {
    const raw = (process.env.PUCOMEX_ENV || 'validacao').toLowerCase();
    if (raw === 'producao' || raw === 'production' || raw === 'prod') return 'producao';
    if (raw === 'homologacao' || raw === 'hom') return 'homologacao';
    return 'validacao';
  }

  getBaseUrl(): string {
    const override = process.env.PUCOMEX_BASE_URL?.trim();
    if (override) return override.replace(/\/$/, '');
    return PUCOMEX_ENVIRONMENTS[this.getEnvironmentId()].baseUrl;
  }

  getRoleType(): PucomexRoleType {
    const fallback: PucomexRoleType = this.profile === 'representante' ? 'IMPEXP' : DEFAULT_PUCOMEX_ROLE;
    const raw = (this.env('ROLE_TYPE')?.trim() || fallback).toUpperCase();
    return (raw as PucomexRoleType) || fallback;
  }

  getCertPath(): string | null {
    const p = this.env('CERT_PFX_PATH')?.trim();
    return p || null;
  }

  getCertThumbprint(): string | null {
    // Representante (e-CPF) só por PFX — sem certificado do Windows.
    if (this.profile === 'representante') return null;
    const t = (process.env.PUCOMEX_CERT_THUMBPRINT || '').replace(/\s/g, '').toUpperCase();
    if (t) return t;
    // Default: VECTRA HUB no store local quando em Windows
    if (process.platform === 'win32' && process.env.PUCOMEX_USE_VECTRA_HUB_CERT !== 'false') {
      return VECTRA_HUB_CERT_THUMBPRINT_DEFAULT;
    }
    return null;
  }

  getCertSource(): 'pfx' | 'windows-store' | null {
    const p = this.getCertPath();
    if (p && fs.existsSync(p) && this.env('CERT_PASSWORD') !== undefined) return 'pfx';
    if (this.getCertThumbprint() && process.platform === 'win32') return 'windows-store';
    return null;
  }

  isCertConfigured(): boolean {
    return this.getCertSource() !== null;
  }

  /** Live com PFX ou Windows store; PUCOMEX_LIVE=false força demo */
  isLiveModeEnabled(): boolean {
    if (process.env.PUCOMEX_LIVE === 'false' || process.env.PUCOMEX_LIVE === '0') return false;
    return this.isCertConfigured();
  }

  getStatus(): PucomexClientStatus {
    const env = this.getEnvironmentId();
    const source = this.getCertSource();
    const info = this.getCertInfo();
    return {
      profile: this.profile,
      certConfigured: this.isCertConfigured(),
      certPath: this.getCertPath(),
      certThumbprint: this.getCertThumbprint(),
      certSource: source,
      certError: this.getCertError(),
      certSubject: info.subject,
      certValidTo: info.validTo,
      liveModeEnabled: this.isLiveModeEnabled(),
      environment: env,
      baseUrl: this.getBaseUrl(),
      roleType: this.getRoleType(),
      sessionActive: !!this.session && this.session.csrfExpirationMs > Date.now(),
      sessionMode: this.session?.mode ?? null,
      csrfExpiresAt: this.session
        ? new Date(this.session.csrfExpirationMs).toISOString()
        : null,
      lastAuthAt: this.session?.authenticatedAt ?? null,
      minAuthIntervalMs: PUCOMEX_MIN_AUTH_INTERVAL_MS,
      docsHome: 'https://docs.portalunico.siscomex.gov.br/',
    };
  }

  getSessionPublic() {
    if (!this.session) return null;
    return {
      roleType: this.session.roleType,
      environment: this.session.environment,
      authenticatedAt: this.session.authenticatedAt,
      mode: this.session.mode,
      csrfExpiresAt: new Date(this.session.csrfExpirationMs).toISOString(),
      tokenPreview: `${this.session.authorization.slice(0, 16)}…`,
      cnpjeCPF:
        this.profile === 'representante'
          ? process.env.PUCOMEX_REP_LABEL || this.getCertInfo().subject || 'e-CPF do representante (servidor)'
          : process.env.PUCOMEX_CNPJ_LABEL ||
            (this.getCertSource() === 'windows-store'
              ? VECTRA_HUB_CNPJ_LABEL_DEFAULT
              : 'Certificado ICP-Brasil (servidor)'),
      role: this.session.roleType,
    };
  }

  private createPfxAgent(): https.Agent | undefined {
    if (this.getCertSource() !== 'pfx') return undefined;
    const certError = this.getCertError();
    if (certError) throw new Error(certError);
    // getCertError() acabou de validar e cachear a chave path|mtime|size|senha.
    const key = this.certCheck!.key;
    if (this.pfxAgent && this.pfxAgentKey === key) return this.pfxAgent;
    this.pfxAgent?.destroy();
    this.pfxAgent = new https.Agent({
      pfx: fs.readFileSync(this.getCertPath()!),
      passphrase: this.getCertPassword(),
      keepAlive: true,
      rejectUnauthorized: process.env.PUCOMEX_TLS_INSECURE !== 'true',
    });
    this.pfxAgentKey = key;
    return this.pfxAgent;
  }

  private requestViaWindowsStore(
    method: HttpMethod,
    fullUrl: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<RawResponse> {
    const thumbprint = this.getCertThumbprint();
    if (!thumbprint) {
      return Promise.reject(new Error('PUCOMEX_CERT_THUMBPRINT ausente'));
    }

    const payload = JSON.stringify({
      thumbprint,
      method,
      url: fullUrl,
      headers,
      body: body ?? '',
    });

    return new Promise((resolve, reject) => {
      const ps = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', WINDOWS_CERT_SCRIPT],
        { windowsHide: true },
      );
      let stdout = '';
      let stderr = '';
      ps.stdout.on('data', (d) => {
        stdout += d.toString('utf8');
      });
      ps.stderr.on('data', (d) => {
        stderr += d.toString('utf8');
      });
      ps.on('error', reject);
      ps.on('close', (code) => {
        try {
          const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
          const parsed = JSON.parse(line) as {
            status: number;
            headers?: Record<string, string>;
            bodyText?: string;
          };
          const bodyText = parsed.bodyText || '';
          resolve({
            status: parsed.status || 0,
            headers: parsed.headers || {},
            bodyText,
            bodyJson: parseBodyJson(bodyText),
          });
        } catch (err) {
          reject(
            new Error(
              `Windows cert bridge falhou (code=${code}): ${stderr || stdout || (err as Error).message}`,
            ),
          );
        }
      });
      ps.stdin.write(payload, 'utf8');
      ps.stdin.end();
    });
  }

  private requestViaPfx(
    method: HttpMethod,
    url: URL,
    headers: Record<string, string>,
    body?: string,
  ): Promise<RawResponse> {
    const agent = this.createPfxAgent();
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method,
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
          },
          agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const bodyText = Buffer.concat(chunks).toString('utf8');
            const outHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (typeof v === 'string') outHeaders[k] = v;
              else if (Array.isArray(v)) outHeaders[k] = v.join(', ');
            }
            resolve({
              status: res.statusCode || 0,
              headers: outHeaders,
              bodyText,
              bodyJson: parseBodyJson(bodyText),
            });
          });
        },
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  private async requestRaw(
    method: HttpMethod,
    pathOrUrl: string,
    opts: {
      headers?: Record<string, string>;
      body?: string | Buffer;
      useMtls?: boolean;
    } = {},
  ): Promise<RawResponse> {
    const base = this.getBaseUrl();
    const full = pathOrUrl.startsWith('http')
      ? pathOrUrl
      : `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
    const headers = { ...(opts.headers || {}) };
    const body = opts.body ? (typeof opts.body === 'string' ? opts.body : opts.body.toString('utf8')) : undefined;

    if (opts.useMtls === false) {
      return this.requestViaPfx(method, new URL(full), headers, body);
    }

    if (!this.isLiveModeEnabled()) {
      throw new Error('Live PUCOMEX desabilitado — use authenticate() em modo demo');
    }

    const source = this.getCertSource();
    if (source === 'windows-store') {
      return this.requestViaWindowsStore(method, full, headers, body);
    }
    if (source === 'pfx') {
      return this.requestViaPfx(method, new URL(full), headers, body);
    }
    throw new Error('Nenhum certificado PUCOMEX configurado (PFX ou thumbprint Windows)');
  }

  private absorbTokenHeaders(headers: Record<string, string>) {
    if (!this.session) return;
    const setToken = headerGet(headers, 'Set-Token') || headerGet(headers, 'Authorization');
    const csrf = headerGet(headers, 'X-CSRF-Token');
    const exp = headerGet(headers, 'X-CSRF-Expiration');
    if (setToken) this.session.authorization = setToken;
    if (csrf) this.session.csrfToken = csrf;
    if (exp) {
      const n = Number(exp);
      this.session.csrfExpirationMs = Number.isFinite(n) ? n : Date.now() + PUCOMEX_CSRF_TTL_MS;
    } else if (csrf) {
      this.session.csrfExpirationMs = Date.now() + PUCOMEX_CSRF_TTL_MS;
    }
  }

  private authHeaders(): Record<string, string> {
    if (!this.session) throw new Error('Sessão PUCOMEX ausente. Autentique primeiro.');
    return {
      Authorization: this.session.authorization,
      'X-CSRF-Token': this.session.csrfToken,
    };
  }

  /** Demo session quando não há PFX — nunca chama Serpro */
  authenticateDemo(roleType?: PucomexRoleType): PucomexSessionTokens {
    const role = roleType || this.getRoleType();
    this.session = {
      authorization: `demo-jwt-${Date.now()}`,
      csrfToken: `demo-csrf-${Date.now()}`,
      csrfExpirationMs: Date.now() + PUCOMEX_CSRF_TTL_MS,
      roleType: role,
      environment: this.getEnvironmentId(),
      authenticatedAt: new Date().toISOString(),
      mode: 'demo',
    };
    return this.session;
  }

  async authenticate(force = false, roleType?: PucomexRoleType): Promise<{
    success: boolean;
    session: ReturnType<PucomexClient['getSessionPublic']>;
    mode: 'live' | 'demo';
    error?: string;
    code?: string;
  }> {
    const role = roleType || this.getRoleType();

    if (!this.isLiveModeEnabled()) {
      this.authenticateDemo(role);
      return {
        success: true,
        session: this.getSessionPublic(),
        mode: 'demo',
        error:
          this.profile === 'representante'
            ? 'e-CPF do representante não configurado (PUCOMEX_REP_CERT_PFX_PATH + PUCOMEX_REP_CERT_PASSWORD). Sessão DEMO ativa.'
            : 'Certificado não configurado (PFX ou PUCOMEX_CERT_THUMBPRINT / VECTRA HUB no Windows). Sessão DEMO ativa.',
        code: 'PUCOMEX_DEMO_MODE',
      };
    }

    const certError = this.getCertError();
    if (certError) {
      // Não gasta tentativa no Portal: o PFX nem abre localmente.
      return { success: false, session: null, mode: 'live', error: certError, code: 'PUCOMEX_CERT_INVALID' };
    }

    const now = Date.now();
    if (
      !force &&
      this.session?.mode === 'live' &&
      this.session.csrfExpirationMs > now + 60_000
    ) {
      return { success: true, session: this.getSessionPublic(), mode: 'live' };
    }

    // Requisições simultâneas (ex.: vários 401) compartilham uma única chamada a autenticar.
    if (this.inflightAuth) return this.inflightAuth;

    // Política do Portal: mínimo 60s entre autenticar() — vale também para force.
    if (now - this.lastAuthAttemptMs < PUCOMEX_MIN_AUTH_INTERVAL_MS) {
      return {
        success: false,
        session: this.getSessionPublic(),
        mode: 'live',
        error: `Portal exige intervalo mínimo de ${PUCOMEX_MIN_AUTH_INTERVAL_MS / 1000}s entre autenticar(). Reutilize o X-CSRF-Token.`,
        code: 'PUCOMEX_AUTH_THROTTLE',
      };
    }

    this.lastAuthAttemptMs = now;
    this.inflightAuth = this.doAuthenticate(role);
    try {
      return await this.inflightAuth;
    } finally {
      this.inflightAuth = null;
    }
  }

  private async doAuthenticate(role: PucomexRoleType): Promise<{
    success: boolean;
    session: ReturnType<PucomexClient['getSessionPublic']>;
    mode: 'live' | 'demo';
    error?: string;
    code?: string;
  }> {
    try {
      const res = await this.requestRaw('POST', '/portal/api/autenticar', {
        headers: { 'Role-Type': role },
        useMtls: true,
      });

      const setToken = headerGet(res.headers, 'Set-Token');
      const csrf = headerGet(res.headers, 'X-CSRF-Token');
      const expRaw = headerGet(res.headers, 'X-CSRF-Expiration');
      const exp = expRaw ? Number(expRaw) : Date.now() + PUCOMEX_CSRF_TTL_MS;

      if (res.status >= 200 && res.status < 300 && setToken && csrf) {
        this.session = {
          authorization: setToken,
          csrfToken: csrf,
          csrfExpirationMs: Number.isFinite(exp) ? exp : Date.now() + PUCOMEX_CSRF_TTL_MS,
          roleType: role,
          environment: this.getEnvironmentId(),
          authenticatedAt: new Date().toISOString(),
          mode: 'live',
        };
        return { success: true, session: this.getSessionPublic(), mode: 'live' };
      }

      const errBody = res.bodyJson as { message?: string; code?: string } | null;
      return {
        success: false,
        session: null,
        mode: 'live',
        error: errBody?.message || res.bodyText || `HTTP ${res.status}`,
        code: errBody?.code || `HTTP_${res.status}`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        session: null,
        mode: 'live',
        error: err instanceof Error ? err.message : String(err),
        code: 'PUCOMEX_NETWORK',
      };
    }
  }

  async ensureSession(): Promise<void> {
    if (this.session && this.session.csrfExpirationMs > Date.now() + 30_000) return;
    const r = await this.authenticate(false);
    if (!r.success && r.mode === 'live') throw new Error(r.error || 'Falha autenticação PUCOMEX');
  }

  async apiRequest(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: unknown; mode: 'live' | 'demo'; path: string }> {
    await this.ensureSession();

    if (this.session?.mode === 'demo') {
      return {
        status: 200,
        mode: 'demo',
        path,
        data: {
          stub: true,
          mode: 'demo',
          message: 'Resposta DEMO — configure PFX A1 para chamar o Portal real.',
          requested: { method, path, body: body ?? null },
          docs: 'https://docs.portalunico.siscomex.gov.br/introducao-api-publica/',
        },
      };
    }

    const res = await this.requestRaw(method, path, {
      headers: this.authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      useMtls: true,
    });
    this.absorbTokenHeaders(res.headers);

    if (res.status === 401) {
      const reauth = await this.authenticate(true);
      if (!reauth.success) {
        return { status: 401, mode: 'live', path, data: { error: reauth.error, code: reauth.code } };
      }
      const retry = await this.requestRaw(method, path, {
        headers: this.authHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        useMtls: true,
      });
      this.absorbTokenHeaders(retry.headers);
      return { status: retry.status, mode: 'live', path, data: retry.bodyJson ?? retry.bodyText };
    }

    return { status: res.status, mode: 'live', path, data: res.bodyJson ?? res.bodyText };
  }

  consultDue(numero: string) {
    const path = fillPathTemplate('/due/api/ext/due/numero-da-due/{numero}', { numero });
    return this.apiRequest('GET', path);
  }

  consultDuimp(numero: string, versao = '1') {
    const path = fillPathTemplate('/duimp/api/ext/duimp/{numero}/{versao}', { numero, versao });
    return this.apiRequest('GET', path);
  }

  consultCct(identificador: string, modal: 'exportacao' | 'aquaviario' = 'aquaviario') {
    if (modal === 'exportacao') {
      const path = fillPathTemplate('/cct/api/ext/carga/consulta-por-due/{numero}', {
        numero: identificador,
      });
      return this.apiRequest('GET', path);
    }
    const path = fillPathTemplate('/ccta/api/ext/conhecimentos/{identificador}', { identificador });
    return this.apiRequest('GET', path);
  }

  /**
   * NCM pela tabela pública oficial (o Portal não tem consulta por código).
   * Não usa certificado nem sessão: é download público com cache de 24 h.
   */
  async consultNcm(
    codigo: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<{ status: number; data: unknown; mode: 'live' | 'demo'; path: string }> {
    const path = NCM_TABLE_PATH;
    try {
      const table = await getNcmTable(this.getBaseUrl(), fetchImpl);
      const found = lookupNcm(table, codigo);
      if (!found) {
        return { status: 404, mode: 'live', path, data: { error: `NCM ${codigo} não encontrada na tabela vigente` } };
      }
      return { status: 200, mode: 'live', path, data: found };
    } catch (err) {
      return { status: 503, mode: 'live', path, data: { error: err instanceof Error ? err.message : String(err) } };
    }
  }

  /**
   * Tratamento administrativo (LPCO/anuentes) da importação — serviço documentado e autenticado.
   * fundamentoLegal NAO_SE_APLICA = importação comum (mesmo valor que a tela do Portal usa).
   */
  simulateTaImport(ncm: string, paisIso2: string) {
    return this.apiRequest('POST', '/talpco/api/ext/simular-ta/importacao', {
      pais: paisIso2,
      condicaoMercadoria: 'NOVA',
      ncm: ncm.replace(/\D/g, ''),
      atributos: [],
      fundamentoLegal: 'NAO_SE_APLICA',
      camposAdicionais: [],
    });
  }

  private ttceCache = new Map<string, unknown>();

  /** Tratamentos tributários do capítulo (TTCE em lote): obtém o hash do dia e baixa o arquivo (cache por hash). */
  async ttceChapter(capitulo: string, data: string): Promise<{ status: number; data: unknown; mode: 'live' | 'demo' }> {
    const cap = capitulo.padStart(2, '0').slice(0, 2);
    const h = await this.apiRequest('GET', `/ttce/api/ext/importacao/ncm-capitulos/${cap}/hash?data=${data}`);
    if (h.mode === 'demo' || h.status >= 400) return { status: h.status, data: h.data, mode: h.mode };
    const hash = String((h.data as { hash?: string } | null)?.hash ?? '');
    if (!hash) return { status: 502, data: { error: 'TTCE não devolveu hash do capítulo' }, mode: 'live' };
    const key = `${cap}|${hash}`;
    if (this.ttceCache.has(key)) return { status: 200, data: this.ttceCache.get(key), mode: 'live' };
    const f = await this.apiRequest(
      'GET',
      `/ttce/api/ext/importacao/ncm-capitulos/${cap}/tratamentos-tributarios?data=${data}&hash=${encodeURIComponent(hash)}`,
    );
    if (f.status < 400) {
      this.ttceCache.clear(); // guarda só o capítulo mais recente (arquivos grandes)
      this.ttceCache.set(key, f.data);
    }
    return { status: f.status, data: f.data, mode: f.mode };
  }

  consultCatalogoProduto(query: Record<string, string> = {}) {
    const qs = new URLSearchParams(query).toString();
    const path = `/catalogo-produtos-ext/api/ext/produto${qs ? `?${qs}` : ''}`;
    return this.apiRequest('GET', path);
  }
}

/** e-CNPJ VECTRA HUB (OPERPORT) — perfil padrão de todas as consultas. */
export const pucomexClient = new PucomexClient('empresa');
/** e-CPF do representante do importador (IMPEXP) — TA/LPCO e TTCE de importação. */
export const pucomexRepClient = new PucomexClient('representante');
