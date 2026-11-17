import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNcmTable, lookupNcm, parseNcmTable, resetNcmTableCache } from '../core/comex/ncmTable';
import { PucomexClient } from '../core/comex/pucomexClient';

const RAW =
  '﻿' +
  JSON.stringify({
    Data_Ultima_Atualizacao_NCM: 'Vigente em 16/11/2026',
    Nomenclaturas: [
      { Codigo: '95', Descricao: 'Brinquedos, jogos, artigos para divertimento ou para esporte' },
      { Codigo: '95.06', Descricao: 'Artigos e equipamentos para cultura física...' },
      { Codigo: '9506.9', Descricao: '- Outros:' },
      { Codigo: '9506.91.00', Descricao: '-- Artigos e equipamentos para cultura física, ginástica ou atletismo', Data_Inicio: '01/04/2022' },
    ],
  });

const okFetch = () =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => RAW }) as unknown as typeof fetch;

beforeEach(() => resetNcmTableCache());

describe('tabela NCM pública', () => {
  it('acha 9506.91.00 com ou sem pontos e monta a hierarquia', () => {
    const t = parseNcmTable(RAW);
    const r = lookupNcm(t, '95069100');
    expect(r?.ncm.Codigo).toBe('9506.91.00');
    expect(r?.hierarquia.map((h) => h.Codigo)).toEqual(['95', '95.06', '9506.9']);
    expect(r?.tabelaAtualizadaEm).toBe('Vigente em 16/11/2026');
    expect(lookupNcm(t, '9506.91.00')?.ncm.Codigo).toBe('9506.91.00');
  });

  it('código inexistente ou incompleto devolve null', () => {
    const t = parseNcmTable(RAW);
    expect(lookupNcm(t, '9999.99.99')).toBeNull();
    expect(lookupNcm(t, '9506')).toBeNull();
  });

  it('baixa uma vez e usa o cache por 24 h', async () => {
    const f = okFetch();
    await getNcmTable('https://val.x', f, 0);
    await getNcmTable('https://val.x', f, 23 * 3600e3);
    expect(f).toHaveBeenCalledTimes(1);
    await getNcmTable('https://val.x', f, 25 * 3600e3);
    expect(f).toHaveBeenCalledTimes(2);
    expect((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe(
      'https://val.x/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO',
    );
  });

  it('consultNcm do cliente: 200 achado, 404 não achado, 503 se o download falhar', async () => {
    const c = new PucomexClient();
    const ok = await c.consultNcm('9506.91.00', okFetch());
    expect(ok.status).toBe(200);
    expect((ok.data as { ncm: { Codigo: string } }).ncm.Codigo).toBe('9506.91.00');
    expect((await c.consultNcm('1234.56.78', okFetch())).status).toBe(404);
    resetNcmTableCache();
    const fail = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' }) as unknown as typeof fetch;
    expect((await c.consultNcm('9506.91.00', fail)).status).toBe(503);
  });
});
