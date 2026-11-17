/**
 * Cálculo puro do uso do limite Radar (aviso, nunca bloqueio).
 * Sem imports node:* — o front React também importa este módulo.
 */
import type { ComexClientRecord, ComexProcessRecord } from '../../types/comex';
import { defaultRadarLimit } from './comexRegistry';

export type RadarLevel = 'ok' | 'atencao' | 'estouro' | 'sem_limite';

export interface RadarUsage {
  clientId: string;
  basis: 'fob' | 'cif';
  window: 'rolling' | 'calendar';
  windowFrom: string;
  windowTo: string;
  limitUsd: number | null;
  usedUsd: number;
  pct: number | null;
  level: RadarLevel;
  counted: string[];
  missingValue: string[];
}

export interface RadarUsageOptions {
  refDate: string;
  basis?: 'fob' | 'cif';
  window?: 'rolling' | 'calendar';
}

function envVar(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[name];
}

export function parseUsd(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/\s+/g, '').replace(/^US?\$/i, '');
  if (!s || !/^[0-9.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // o último separador é o decimal
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    s = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    // "12.000" / "1.234.567" = milhar; "12.5" / "12.50" = decimal
    if (!(parts.length === 2 && parts[1].length !== 3)) s = parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return isoDate(new Date(Date.UTC(ny, nm, Math.min(d, lastDay))));
}

function dateField(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : null;
}

export function processRadarDate(p: ComexProcessRecord): string {
  const pl = p.payload || {};
  return dateField(pl.duimp_registered_at) ?? dateField(pl.eta_date) ?? String(p.created_at || '').slice(0, 10);
}

export function computeRadarUsage(
  client: ComexClientRecord,
  processes: ComexProcessRecord[],
  opts: RadarUsageOptions,
): RadarUsage {
  const basis: 'fob' | 'cif' = opts.basis ?? (envVar('COMEX_RADAR_BASIS') === 'cif' ? 'cif' : 'fob');
  const window: 'rolling' | 'calendar' =
    opts.window ?? (envVar('COMEX_RADAR_WINDOW') === 'calendar' ? 'calendar' : 'rolling');
  const ref = opts.refDate.slice(0, 10);

  let windowFrom: string;
  let inWindow: (d: string) => boolean;
  if (window === 'rolling') {
    windowFrom = subMonths(ref, 6);
    inWindow = (d) => d > windowFrom && d <= ref;
  } else {
    const month = Number(ref.slice(5, 7));
    windowFrom = `${ref.slice(0, 4)}-${month <= 6 ? '01' : '07'}-01`;
    inWindow = (d) => d >= windowFrom && d <= ref;
  }

  const field = basis === 'cif' ? 'cif_value_usd' : 'fob_value_usd';
  let usedUsd = 0;
  const counted: string[] = [];
  const missingValue: string[] = [];
  for (const p of processes) {
    if (p.cliente_id !== client.id) continue;
    if (p.payload?.type !== 'importacao') continue;
    if (!inWindow(processRadarDate(p))) continue;
    counted.push(p.code);
    const val = parseUsd(p.payload[field]);
    if (val === null) missingValue.push(p.code);
    else usedUsd += val;
  }

  const limitUsd = client.radar_limit_usd ?? defaultRadarLimit(client.radar_modality);
  let pct: number | null = null;
  let level: RadarLevel = 'sem_limite';
  if (limitUsd !== null && limitUsd > 0) {
    pct = usedUsd / limitUsd;
    level = pct > 1 ? 'estouro' : pct >= 0.8 ? 'atencao' : 'ok';
  }

  return {
    clientId: client.id,
    basis,
    window,
    windowFrom,
    windowTo: ref,
    limitUsd,
    usedUsd,
    pct,
    level,
    counted,
    missingValue,
  };
}
