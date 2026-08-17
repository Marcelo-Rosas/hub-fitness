import type { DreGranularItem, PayrollRole } from '../types';
import { mixBePct, mixNonHcOpexFromLedger } from './mixPreview';
import { payrollTotal } from './payrollRoles';

export function mixRowBePcts(args: {
  mcPos: number;
  items: DreGranularItem[];
  payrollRoles: PayrollRole[];
  capacity: number;
}): { cct: number; mediana: number; caged: number } {
  const opex = mixNonHcOpexFromLedger(args.items);
  const cost = (mode: 'cct' | 'mediana' | 'caged') => opex + payrollTotal(args.payrollRoles, mode);
  return {
    cct: mixBePct(cost('cct'), args.mcPos, args.capacity),
    mediana: mixBePct(cost('mediana'), args.mcPos, args.capacity),
    caged: mixBePct(cost('caged'), args.mcPos, args.capacity),
  };
}
