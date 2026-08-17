import { describe, it, expect } from 'vitest';
import { resolvePlannerSearch } from './m6LegacyRoutes';

describe('resolvePlannerSearch', () => {
  it('maps old M6 tabs', () => {
    expect(resolvePlannerSearch('?module=M6&tab=mix')).toEqual({ module: 'M6' });
    expect(resolvePlannerSearch('?module=M6&tab=matriz')).toEqual({ module: 'M6' });
    expect(resolvePlannerSearch('?module=M6&tab=enquadramento')).toEqual({
      module: 'KB',
      article: 'm6-enquadramento',
    });
    expect(resolvePlannerSearch('?module=M6&tab=board_memo')).toEqual({
      module: 'KB',
      article: 'm6-board-memo',
    });
    expect(resolvePlannerSearch('?module=M6&tab=plano_contas')).toEqual({
      module: 'M11',
    });
  });

  it('keeps M11 as Plano de Contas', () => {
    expect(resolvePlannerSearch('?module=M11')).toEqual({ module: 'M11' });
  });
});
