import { describe, it, expect } from 'vitest';
import { canViewModule, visibleModules, firstVisibleModule } from '../core/rbac/moduleVisibility';
import {
  canEditFinance,
  canEditCompras,
  canManageOrg,
  canDecideIntranet,
  canEditCrm,
  canInspectCells,
} from '../core/rbac/moduleEdit';

describe('moduleVisibility', () => {
  it('compras não vê M2 nem M4', () => {
    expect(canViewModule('compras', 'M2')).toBe(false);
    expect(canViewModule('compras', 'M4')).toBe(false);
  });

  it('compras vê M10 e M19', () => {
    expect(canViewModule('compras', 'M10')).toBe(true);
    expect(canViewModule('compras', 'M19')).toBe(true);
  });

  it('M11 is own finance module, not an alias of M6', () => {
    expect(canViewModule('cfo', 'M11')).toBe(true);
    expect(canViewModule('cfo', 'M6')).toBe(true);
    expect(canViewModule('comercial', 'M11')).toBe(false);
    expect(canViewModule('comercial', 'M6')).toBe(false);
    expect(canViewModule('comercial', 'KB')).toBe(true);
  });

  it('cfo vê M2 e M19', () => {
    expect(canViewModule('cfo', 'M2')).toBe(true);
    expect(canViewModule('cfo', 'M19')).toBe(true);
  });

  it('visibleModules(compras) sem M2', () => {
    const list = visibleModules('compras');
    expect(list).toContain('M1');
    expect(list).not.toContain('M2');
    expect(list).toEqual(['M1', 'M10', 'M19', 'KB']);
  });

  it('firstVisibleModule fallback', () => {
    expect(firstVisibleModule('compras')).toBe('M1');
  });
});

describe('moduleEdit', () => {
  it('canManageOrg só socio', () => {
    expect(canManageOrg('socio')).toBe(true);
    expect(canManageOrg('cfo')).toBe(false);
    expect(canManageOrg('compras')).toBe(false);
  });

  it('canEditFinance cfo e socio', () => {
    expect(canEditFinance('cfo')).toBe(true);
    expect(canEditFinance('socio')).toBe(true);
    expect(canEditFinance('comite')).toBe(false);
  });

  it('canEditCompras inclui compras', () => {
    expect(canEditCompras('compras')).toBe(true);
    expect(canEditCompras('comercial')).toBe(false);
  });

  it('canDecideIntranet cfo/socio', () => {
    expect(canDecideIntranet('cfo')).toBe(true);
    expect(canDecideIntranet('compras')).toBe(false);
  });

  it('canEditCrm e canInspectCells', () => {
    expect(canEditCrm('comercial')).toBe(true);
    expect(canInspectCells('comite')).toBe(true);
    expect(canInspectCells('comercial')).toBe(false);
  });
});
