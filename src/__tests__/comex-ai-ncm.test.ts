import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPortalNcmIfAuthorized } from '../core/comex/comexAiNcm';

const TOKEN = 'tok-operador-1234567890';
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.COMEX_OPERATOR_TOKEN;
  process.env.COMEX_OPERATOR_TOKEN = TOKEN;
});
afterEach(() => {
  if (saved === undefined) delete process.env.COMEX_OPERATOR_TOKEN;
  else process.env.COMEX_OPERATOR_TOKEN = saved;
});

describe('fetchPortalNcmIfAuthorized', () => {
  it('sem header não chama consultNcm', async () => {
    const consultNcm = vi.fn().mockResolvedValue({ data: { x: 1 } });
    const out = await fetchPortalNcmIfAuthorized({ headers: {} }, '9506.91.00', { consultNcm });
    expect(out).toBeNull();
    expect(consultNcm).not.toHaveBeenCalled();
  });

  it('token errado não chama consultNcm', async () => {
    const consultNcm = vi.fn();
    const out = await fetchPortalNcmIfAuthorized({ headers: { 'x-comex-token': 'errado' } }, '1', { consultNcm });
    expect(out).toBeNull();
    expect(consultNcm).not.toHaveBeenCalled();
  });

  it('sem token no servidor não chama consultNcm', async () => {
    delete process.env.COMEX_OPERATOR_TOKEN;
    const consultNcm = vi.fn();
    await fetchPortalNcmIfAuthorized({ headers: { 'x-comex-token': TOKEN } }, '1', { consultNcm });
    expect(consultNcm).not.toHaveBeenCalled();
  });

  it('com header válido chama consultNcm e devolve data', async () => {
    const consultNcm = vi.fn().mockResolvedValue({ data: { ncm: 'ok' } });
    const out = await fetchPortalNcmIfAuthorized({ headers: { 'x-comex-token': ` ${TOKEN} ` } }, '9506.91.00', {
      consultNcm,
    });
    expect(consultNcm).toHaveBeenCalledWith('9506.91.00');
    expect(out).toEqual({ ncm: 'ok' });
  });

  it('erro do Portal vira null', async () => {
    const consultNcm = vi.fn().mockRejectedValue(new Error('x'));
    const out = await fetchPortalNcmIfAuthorized({ headers: { 'x-comex-token': TOKEN } }, '1', { consultNcm });
    expect(out).toBeNull();
  });
});
