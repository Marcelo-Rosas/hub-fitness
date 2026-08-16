import type { UserRole } from '../../types';

export type ModuleId =
  | 'M1'
  | 'M2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'M7'
  | 'M8'
  | 'M9'
  | 'M10'
  | 'M11'
  | 'M12'
  | 'M13'
  | 'M14'
  | 'M15'
  | 'M16'
  | 'M17'
  | 'M18'
  | 'M19';

const ALL: ModuleId[] = [
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  'M7',
  'M8',
  'M9',
  'M10',
  'M11',
  'M12',
  'M13',
  'M14',
  'M15',
  'M16',
  'M17',
  'M18',
  'M19',
];

/** Matriz visão sidebar — spec 2026-08-15-rbac-module-visibility-design. */
export const MODULE_VISIBILITY: Record<UserRole, readonly ModuleId[]> = {
  cfo: ALL,
  socio: ALL,
  comite: ALL,
  comercial: ['M1', 'M12', 'M13', 'M14', 'M16'],
  compras: ['M1', 'M10', 'M19'],
};

export function canViewModule(role: UserRole, moduleId: string): boolean {
  const list = MODULE_VISIBILITY[role];
  if (!list) return false;
  const resolved = moduleId === 'M11' ? 'M6' : moduleId;
  return list.includes(resolved as ModuleId);
}

export function visibleModules(role: UserRole): ModuleId[] {
  return [...(MODULE_VISIBILITY[role] || [])];
}

export function firstVisibleModule(role: UserRole): ModuleId {
  return visibleModules(role)[0] || 'M1';
}
