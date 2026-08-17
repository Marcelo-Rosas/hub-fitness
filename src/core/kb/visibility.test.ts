import { describe, it, expect } from 'vitest';
import { visibleArticles, kbHrefForModule, articleById } from './visibility';

describe('kb visibility', () => {
  it('cfo sees three M6 P0 articles', () => {
    const ids = visibleArticles('cfo').map((a) => a.id).sort();
    expect(ids).toEqual(['m6-board-memo', 'm6-enquadramento', 'm6-pisos'].sort());
  });

  it('comercial does not see M6 articles', () => {
    expect(visibleArticles('comercial').some((a) => a.moduleId === 'M6')).toBe(false);
  });

  it('omits stubs', () => {
    expect(visibleArticles('cfo').every((a) => !a.stub)).toBe(true);
  });

  it('m6-pisos cites SITRAROIT not field proxy', () => {
    const a = articleById('m6-pisos');
    const blob = JSON.stringify(a);
    expect(blob).toMatch(/SITRAROIT/);
    expect(blob).not.toMatch(/cct_sc_/);
  });

  it('kbHrefForModule M6 with many articles goes to group', () => {
    expect(kbHrefForModule('cfo', 'M6')).toBe('?module=KB&group=M6');
    expect(kbHrefForModule('cfo', 'M11')).toBeNull();
    expect(kbHrefForModule('comercial', 'M6')).toBeNull();
  });
});
