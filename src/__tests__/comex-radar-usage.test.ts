import { describe, it, expect } from 'vitest';
import { computeRadarUsage, parseUsd, processRadarDate } from '../core/comex/radarUsage';
import type { ComexClientRecord, ComexProcessRecord } from '../types/comex';

const client = {
  id: 'c1',
  radar_modality: 'limitada_50k',
  radar_limit_usd: null,
} as unknown as ComexClientRecord;

function proc(code: string, payload: Record<string, unknown>, over: Partial<ComexProcessRecord> = {}): ComexProcessRecord {
  return {
    id: code,
    code,
    client_slug: null,
    cliente_id: 'c1',
    payload: { type: 'importacao', ...payload },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('radarUsage', () => {
  it('soma FOB dos importações na janela móvel', () => {
    const p1 = proc('P1', { duimp_registered_at: '2026-06-01', fob_value_usd: 20000 });
    const p2 = proc('P2', { duimp_registered_at: '2026-10-01', fob_value_usd: 21000 });
    const p3 = proc('P3', { duimp_registered_at: '2026-05-16', fob_value_usd: 9999 });
    const p4 = proc('P4', { type: 'exportacao', duimp_registered_at: '2026-10-01', fob_value_usd: 50000 });
    const u = computeRadarUsage(client, [p1, p2, p3, p4], { refDate: '2026-11-16' });
    expect(u.usedUsd).toBe(41000);
    expect(u.pct).toBeCloseTo(0.82);
    expect(u.level).toBe('atencao');
    expect(u.windowFrom).toBe('2026-05-16');
    expect(u.windowTo).toBe('2026-11-16');
    expect(u.counted).toEqual(['P1', 'P2']);
  });

  it('estouro acima de 100% e ok abaixo de 80%', () => {
    const mk = (v: number) => [proc('A', { duimp_registered_at: '2026-10-01', fob_value_usd: v })];
    expect(computeRadarUsage(client, mk(50001), { refDate: '2026-11-16' }).level).toBe('estouro');
    expect(computeRadarUsage(client, mk(50000), { refDate: '2026-11-16' }).level).toBe('atencao');
    expect(computeRadarUsage(client, mk(39999), { refDate: '2026-11-16' }).level).toBe('ok');
  });

  it('ignora processos de outro cliente e posteriores à refDate', () => {
    const other = proc('X', { duimp_registered_at: '2026-10-01', fob_value_usd: 1000 }, { cliente_id: 'c2' });
    const future = proc('F', { duimp_registered_at: '2026-12-01', fob_value_usd: 1000 });
    const u = computeRadarUsage(client, [other, future], { refDate: '2026-11-16' });
    expect(u.usedUsd).toBe(0);
    expect(u.counted).toEqual([]);
  });

  it('data: duimp_registered_at > eta_date > created_at', () => {
    expect(processRadarDate(proc('a', { duimp_registered_at: '2026-03-01', eta_date: '2026-04-01' }))).toBe('2026-03-01');
    expect(processRadarDate(proc('b', { eta_date: '2026-04-01' }))).toBe('2026-04-01');
    expect(processRadarDate(proc('c', {}))).toBe('2026-01-01');
  });

  it('parseUsd entende pt-BR e rejeita lixo', () => {
    expect(parseUsd(1500)).toBe(1500);
    expect(parseUsd('12000')).toBe(12000);
    expect(parseUsd('12.000,50')).toBe(12000.5);
    expect(parseUsd('12,000.50')).toBe(12000.5);
    expect(parseUsd('')).toBeNull();
    expect(parseUsd('-5')).toBeNull();
    expect(parseUsd('abc')).toBeNull();
    expect(parseUsd(NaN)).toBeNull();
    expect(parseUsd(null)).toBeNull();
  });

  it('FOB faltando entra em missingValue', () => {
    const p = proc('M', { duimp_registered_at: '2026-10-01' });
    const u = computeRadarUsage(client, [p], { refDate: '2026-11-16' });
    expect(u.counted).toContain('M');
    expect(u.missingValue).toContain('M');
    expect(u.usedUsd).toBe(0);
  });

  it('semestre civil e base CIF', () => {
    const p = proc('C', { duimp_registered_at: '2026-08-01', fob_value_usd: 1, cif_value_usd: 30000 });
    const old = proc('O', { duimp_registered_at: '2026-06-30', cif_value_usd: 99999 });
    const u = computeRadarUsage(client, [p, old], { refDate: '2026-11-16', window: 'calendar', basis: 'cif' });
    expect(u.windowFrom).toBe('2026-07-01');
    expect(u.usedUsd).toBe(30000);
    expect(u.basis).toBe('cif');
    expect(u.window).toBe('calendar');
  });

  it('rolling: fim de mês 31/08 - 6 meses = 28/02', () => {
    const u = computeRadarUsage(client, [], { refDate: '2026-08-31' });
    expect(u.windowFrom).toBe('2026-02-28');
  });

  it('modalidade ilimitada → sem_limite', () => {
    const c = { ...client, radar_modality: 'ilimitada' } as ComexClientRecord;
    const u = computeRadarUsage(c, [proc('A', { duimp_registered_at: '2026-10-01', fob_value_usd: 5 })], { refDate: '2026-11-16' });
    expect(u.level).toBe('sem_limite');
    expect(u.pct).toBeNull();
    expect(u.limitUsd).toBeNull();
  });
});
