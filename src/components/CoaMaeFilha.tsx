import React from 'react';
import { coaMaeFilha } from '../core/engine';

/** Badge mãe sintética / filha analítica — nunca troca filha no lugar da mãe. */
export const CoaMaeFilha: React.FC<{
  accountCode?: string;
  childCode?: string;
  show?: 'mae' | 'filha' | 'pair';
  tone?: 'dark' | 'light';
}> = ({ accountCode, childCode, show = 'pair', tone = 'dark' }) => {
  const { mae, filha: derivedFilha } = coaMaeFilha(accountCode);
  const filha = childCode || derivedFilha;
  const showMae = show !== 'filha' && Boolean(mae);
  const showFilha = show !== 'mae' && Boolean(filha);
  if (!showMae && !showFilha) return null;
  const maeCls = tone === 'light' ? 'text-slate-500' : 'text-slate-500';
  const filhaCls = tone === 'light' ? 'text-sky-800' : 'text-cyan-400/90';
  return (
    <span className="inline-flex items-center gap-1 flex-wrap font-mono text-[10px]">
      {showMae ? <span className={maeCls}>{mae}</span> : null}
      {showMae && showFilha ? <span className="text-slate-400">›</span> : null}
      {showFilha ? <span className={filhaCls}>{filha}</span> : null}
    </span>
  );
};
