import type { UserRole } from '../../types';

export function canEditFinance(role: UserRole): boolean {
  return role === 'cfo' || role === 'socio';
}

export function canEditCompras(role: UserRole): boolean {
  return role === 'cfo' || role === 'socio' || role === 'compras';
}

/** Árvore / Cargos / Funcionários / Cadastro CoA — só sócio. */
export function canManageOrg(role: UserRole): boolean {
  return role === 'socio';
}

export function canDecideIntranet(role: UserRole): boolean {
  return role === 'cfo' || role === 'socio';
}

export function canEditCrm(role: UserRole): boolean {
  return role === 'cfo' || role === 'socio' || role === 'comercial';
}

export function canInspectCells(role: UserRole): boolean {
  return role === 'cfo' || role === 'socio' || role === 'comite';
}
