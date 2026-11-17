import { describe, expect, it, vi } from 'vitest';
import {
  fetchLastUpdates,
  formatWarning,
  INTEGRA_ENDPOINTS,
  IntegraComexError,
  isValidDocNumber,
  normalizeDocNumber,
  parseLiList,
  trackingDocsFromPayload,
} from '../core/comex/integraComexPublic';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('normalização dos números', () => {
  it('CE: só dígitos, 15', () => {
    expect(normalizeDocNumber('ce', ' 1319.0500.0018-565 ')).toBe('131905000018565');
    expect(isValidDocNumber('ce', '131905000018565')).toBe(true);
    expect(isValidDocNumber('ce', '13190500001856')).toBe(false);
  });

  it('DI: aceita a máscara 25/1234567-8', () => {
    expect(normalizeDocNumber('di', '25/1234567-8')).toBe('2512345678');
    expect(isValidDocNumber('di', '2512345678')).toBe(true);
    expect(isValidDocNumber('di', '251234567')).toBe(false);
  });

  it('LI: lista separada por vírgula, 10 dígitos cada, sem repetidos', () => {
    expect(parseLiList('25/1234567-8, 2598765432 ,,2512345678')).toEqual(['2512345678', '2598765432']);
    expect(parseLiList('')).toEqual([]);
    expect(parseLiList(null)).toEqual([]);
  });

  it('DUIMP: maiúsculas, ^\\d{2}BR\\d{11}$', () => {
    expect(normalizeDocNumber('duimp', ' 25br0000012345-6 ')).toBe('25BR00000123456');
    expect(isValidDocNumber('duimp', '25BR00000123456')).toBe(true);
    expect(isValidDocNumber('duimp', '25BR0000012345')).toBe(false);
    expect(isValidDocNumber('duimp', '2512345678')).toBe(false);
  });

  it('formatWarning: avisa sem bloquear; vazio não avisa', () => {
    expect(formatWarning('ce', '131905000018565')).toBeNull();
    expect(formatWarning('ce', '')).toBeNull();
    expect(formatWarning('ce', '123')).toMatch(/15 dígitos/);
    expect(formatWarning('di', '25/1234567-8')).toBeNull();
    expect(formatWarning('di', '123')).toMatch(/10 dígitos/);
    expect(formatWarning('li', '2512345678, 123')).toMatch(/123/);
    expect(formatWarning('li', '2512345678,2598765432')).toBeNull();
    expect(formatWarning('duimp', '25BR00000123456')).toBeNull();
    expect(formatWarning('duimp', '25BR123')).toMatch(/25BR/);
  });
});

describe('trackingDocsFromPayload', () => {
  it('extrai CE, DI, LIs e DUIMP (só importação com padrão DUIMP); ignora formato inválido', () => {
    const docs = trackingDocsFromPayload({
      type: 'importacao',
      ce_mercante_number: '131905000018565',
      di_number: '25/1234567-8',
      li_numbers: '2512345678, 123',
      declaration_number: '25br00000123456',
    });
    expect(docs).toEqual([
      { kind: 'ce', number: '131905000018565' },
      { kind: 'di', number: '2512345678' },
      { kind: 'li', number: '2512345678' },
      { kind: 'duimp', number: '25BR00000123456' },
    ]);
  });

  it('exportação não vira DUIMP; DU-E fica fora', () => {
    expect(trackingDocsFromPayload({ type: 'exportacao', declaration_number: '25BR00000123456' })).toEqual([]);
  });
});

describe('fetchLastUpdates — cliente', () => {
  it('CE: nr repetido e mapa numero → data', async () => {
    const impl = vi.fn(async () =>
      jsonResponse([{ numero: '131905000018565', dataAtualizacao: '2019-01-28T18:09:25' }]),
    );
    const r = await fetchLastUpdates('ce', ['131905000018565', '131905000018566'], {
      fetchImpl: impl as unknown as typeof fetch,
    });
    expect(impl).toHaveBeenCalledTimes(1);
    const url = String((impl.mock.calls[0] as unknown[])[0]);
    expect(url).toBe(`${INTEGRA_ENDPOINTS.ce.url}?nr=131905000018565&nr=131905000018566`);
    expect(r.get('131905000018565')).toEqual({ updatedAt: '2019-01-28T18:09:25', version: null });
    expect(r.has('131905000018566')).toBe(false);
  });

  it('LI usa o caminho /siscomex-li-api (não o do swagger)', () => {
    expect(INTEGRA_ENDPOINTS.li.url).toBe(
      'https://siscomex-li.estaleiro.serpro.gov.br/siscomex-li-api/licencas-importacao/data-ultima-atualizacao',
    );
  });

  it('quebra em lotes de 50 (CE/DI/LI) e de 100 (DUIMP)', async () => {
    const impl = vi.fn(async () => jsonResponse([]));
    const ces = Array.from({ length: 120 }, (_, i) => String(100000000000000 + i));
    await fetchLastUpdates('ce', ces, { fetchImpl: impl as unknown as typeof fetch });
    expect(impl).toHaveBeenCalledTimes(3);

    const dimp = vi.fn(async () => jsonResponse({ code: 200, multiStatus: [] }));
    const duimps = Array.from({ length: 150 }, (_, i) => `25BR${String(i).padStart(11, '0')}`);
    await fetchLastUpdates('duimp', duimps, { fetchImpl: dimp as unknown as typeof fetch });
    expect(dimp).toHaveBeenCalledTimes(2);
    const u = String((dimp.mock.calls[0] as unknown[])[0]);
    expect(u.startsWith(`${INTEGRA_ENDPOINTS.duimp.url}?duimp=25BR00000000000&duimp=`)).toBe(true);
    expect(u.includes('nr=')).toBe(false);
  });

  it('DUIMP: lê multiStatus com versão vigente', async () => {
    const impl = vi.fn(async () =>
      jsonResponse({
        code: 207,
        multiStatus: [
          { numero: '25BR00000123456', dataAtualizacao: '2026-11-16T10:11:00', versaoVigente: 2, code: 200 },
          { numero: '25BR00000999999', code: 404, message: 'não encontrada' },
        ],
      }),
    );
    const r = await fetchLastUpdates('duimp', ['25BR00000123456', '25BR00000999999'], {
      fetchImpl: impl as unknown as typeof fetch,
    });
    expect(r.get('25BR00000123456')).toEqual({ updatedAt: '2026-11-16T10:11:00', version: 2 });
    expect(r.size).toBe(1);
  });

  it('404 de LI e de DUIMP = nada encontrado (não é erro)', async () => {
    const li = vi.fn(async () => jsonResponse({ code: 'SILI-4004', message: 'Nenhuma LI encontrada' }, 404));
    expect((await fetchLastUpdates('li', ['2512345678'], { fetchImpl: li as unknown as typeof fetch })).size).toBe(0);
    const du = vi.fn(async () =>
      jsonResponse({ code: 404, multiStatus: [{ numero: '25BR00000123456', code: 404 }] }, 404),
    );
    expect((await fetchLastUpdates('duimp', ['25BR00000123456'], { fetchImpl: du as unknown as typeof fetch })).size).toBe(0);
  });

  it('5xx vira IntegraComexError em pt-BR', async () => {
    const impl = vi.fn(async () => new Response('erro', { status: 503 }));
    await expect(
      fetchLastUpdates('di', ['2512345678'], { fetchImpl: impl as unknown as typeof fetch }),
    ).rejects.toThrow(IntegraComexError);
    await expect(
      fetchLastUpdates('di', ['2512345678'], { fetchImpl: impl as unknown as typeof fetch }),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('timeout vira IntegraComexError', async () => {
    const impl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(
      fetchLastUpdates('ce', ['131905000018565'], { fetchImpl: impl as unknown as typeof fetch, timeoutMs: 20 }),
    ).rejects.toThrow(/tempo/i);
  });

  it('lista vazia não chama a API', async () => {
    const impl = vi.fn();
    expect((await fetchLastUpdates('ce', [], { fetchImpl: impl as unknown as typeof fetch })).size).toBe(0);
    expect(impl).not.toHaveBeenCalled();
  });
});
