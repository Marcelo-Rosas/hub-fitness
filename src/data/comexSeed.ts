import type { PucomexAuthSession } from '../types/comex';

export const INITIAL_PUCOMEX_AUTH: PucomexAuthSession = {
  cnpjeCPF: '00.000.000/0001-00 (HUB-FITNESS Homolog)',
  role: 'Depositário / Operador Logístico',
  environment: 'Homologação',
  tokenPreview: 'eyJhbGciOi***stub***',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

/** Processos vêm do DB (comex_processes.payload) — sem seed hardcoded. */
