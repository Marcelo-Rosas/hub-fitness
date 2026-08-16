import { createHash, randomBytes } from 'node:crypto';
import type { ApprovalTokenRecord, SqliteIntranetStore } from './intranetStore';

export const APPROVAL_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export function appBaseUrl(): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return 'http://localhost:3000';
  }
  return 'https://hub.vectracargo.com.br';
}

/** Opaque raw token (≥32 bytes), URL-safe base64url. */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashApprovalToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function approveUrlForRawToken(raw: string): string {
  return `${appBaseUrl()}/approve/${raw}`;
}

export type MintApprovalTokenResult = {
  rawToken: string;
  tokenHash: string;
  tokenId: string;
  expiresAt: string;
  approveUrl: string;
};

export function mintApprovalToken(
  store: SqliteIntranetStore,
  input: {
    request_id: string;
    assignment_id: string;
    assignee_employee_id: string;
    now?: Date;
  },
): MintApprovalTokenResult {
  const now = input.now || new Date();
  const rawToken = generateRawToken();
  const tokenHash = hashApprovalToken(rawToken);
  const expiresAt = new Date(now.getTime() + APPROVAL_TOKEN_TTL_MS).toISOString();
  const { id } = store.insertApprovalToken({
    token_hash: tokenHash,
    request_id: input.request_id,
    assignment_id: input.assignment_id,
    assignee_employee_id: input.assignee_employee_id,
    expires_at: expiresAt,
  });
  return {
    rawToken,
    tokenHash,
    tokenId: id,
    expiresAt,
    approveUrl: approveUrlForRawToken(rawToken),
  };
}

export type TokenLookupStatus =
  | { ok: true; token: ApprovalTokenRecord }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'USED' };

export function lookupApprovalToken(
  store: SqliteIntranetStore,
  rawToken: string,
  now: Date = new Date(),
): TokenLookupStatus {
  if (!rawToken || rawToken.length < 16) return { ok: false, reason: 'NOT_FOUND' };
  const token = store.getApprovalTokenByHash(hashApprovalToken(rawToken));
  if (!token) return { ok: false, reason: 'NOT_FOUND' };
  if (token.used_at) return { ok: false, reason: 'USED' };
  if (Date.parse(token.expires_at) < now.getTime()) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, token };
}
