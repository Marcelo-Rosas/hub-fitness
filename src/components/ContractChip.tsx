import React from 'react';
import { CONTRACT_META, type ContractId } from '../core/contracts';

export const ContractChip: React.FC<{ id: ContractId; className?: string }> = ({
  id,
  className,
}) => (
  <span
    title={CONTRACT_META[id].formula}
    className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-[9px] font-bold text-slate-600 uppercase tracking-wider ${className ?? ''}`}
  >
    {CONTRACT_META[id].label}
  </span>
);
