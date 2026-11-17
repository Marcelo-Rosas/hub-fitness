import { describe, expect, it } from 'vitest';
import { SqliteComexStore } from '../core/comex/comexStore';
import { isTrackingChanged, syncProcessTracking } from '../core/comex/comexTracking';
import { DEFAULT_COMEX_FIELD_DEFS } from '../core/comex/fieldDefsSeed';

async function freshStore() {
  const store = new SqliteComexStore(':memory:');
  await store.ensureReady();
  return store;
}

describe('campos novos do processo (seed)', () => {
  it('ce_mercante_number, di_number e li_numbers existem perto de BL/declaração', async () => {
    const byKey = Object.fromEntries(
      DEFAULT_COMEX_FIELD_DEFS.filter((d) => d.entity === 'process').map((d) => [d.field_key, d]),
    );
    expect(byKey.ce_mercante_number.label).toBe('Nº CE-Mercante');
    expect(byKey.di_number.label).toBe('Nº DI');
    expect(byKey.li_numbers.label).toBe('Nº LI (separe por vírgula)');
    const store = await freshStore();
    const keys = (await store.listFieldDefs('process')).map((d) => d.field_key);
    expect(keys).toEqual(expect.arrayContaining(['ce_mercante_number', 'di_number', 'li_numbers']));
  });
});

describe('comex_tracking — sincronia com o processo', () => {
  it('criar processo gera as linhas; atualizar mantém, insere e apaga', async () => {
    const store = await freshStore();
    const p = await store.createProcess({
      payload: {
        type: 'importacao',
        ce_mercante_number: '131905000018565',
        li_numbers: '2512345678, 2598765432',
        declaration_number: '25BR00000123456',
      },
    });
    let rows = await store.listTracking(p.id);
    expect(rows.map((r) => `${r.doc_kind}:${r.doc_number}`).sort()).toEqual([
      'ce:131905000018565',
      'duimp:25BR00000123456',
      'li:2512345678',
      'li:2598765432',
    ]);
    const ceId = rows.find((r) => r.doc_kind === 'ce')!.id;
    await store.updateTracking(ceId, { found: true, remote_updated_at: '2026-11-12T09:02:00' });

    await store.updateProcess(p.id, {
      payload: {
        type: 'importacao',
        ce_mercante_number: '131905000018565',
        di_number: '25/1234567-8',
        li_numbers: '2512345678',
        declaration_number: '',
      },
    });
    rows = await store.listTracking(p.id);
    expect(rows.map((r) => `${r.doc_kind}:${r.doc_number}`).sort()).toEqual([
      'ce:131905000018565',
      'di:2512345678',
      'li:2512345678',
    ]);
    const ce = rows.find((r) => r.doc_kind === 'ce')!;
    expect(ce.id).toBe(ceId); // mantém a linha (e o histórico)
    expect(ce.found).toBe(true);
    expect(ce.remote_updated_at).toBe('2026-11-12T09:02:00');
  });

  it('syncProcessTracking pode ser chamado direto; excluir processo apaga as linhas', async () => {
    const store = await freshStore();
    const p = await store.createProcess({ payload: { type: 'importacao' } });
    expect(await store.listTracking(p.id)).toEqual([]);
    await syncProcessTracking(store, p.id, { ce_mercante_number: '131905000018565' });
    expect(await store.listTracking(p.id)).toHaveLength(1);
    await store.deleteProcess(p.id);
    expect(await store.listTracking()).toEqual([]);
  });
});

describe('regra "alterado"', () => {
  const base = { changed_at: null as string | null, seen_at: null as string | null };
  it('sem mudança → não', () => expect(isTrackingChanged(base)).toBe(false));
  it('mudou e não foi visto → sim', () =>
    expect(isTrackingChanged({ ...base, changed_at: '2026-11-17T17:20:00.000Z' })).toBe(true));
  it('visto depois da mudança → não', () =>
    expect(
      isTrackingChanged({ changed_at: '2026-11-17T17:20:00.000Z', seen_at: '2026-11-17T18:00:00.000Z' }),
    ).toBe(false));
  it('mudou de novo depois de visto → sim', () =>
    expect(
      isTrackingChanged({ changed_at: '2026-11-18T10:00:00.000Z', seen_at: '2026-11-17T18:00:00.000Z' }),
    ).toBe(true));

  it('store grava seen_at via updateTracking', async () => {
    const store = await freshStore();
    const p = await store.createProcess({ payload: { ce_mercante_number: '131905000018565' } });
    const [row] = await store.listTracking(p.id);
    await store.updateTracking(row.id, { changed_at: '2026-11-17T17:20:00.000Z' });
    expect(isTrackingChanged((await store.getTracking(row.id))!)).toBe(true);
    await store.updateTracking(row.id, { seen_at: '2026-11-17T18:00:00.000Z' });
    expect(isTrackingChanged((await store.getTracking(row.id))!)).toBe(false);
  });
});
