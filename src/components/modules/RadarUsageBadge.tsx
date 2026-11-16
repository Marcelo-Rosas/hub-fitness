import React from 'react';
import type { RadarLevel, RadarUsage } from '../../core/comex/radarUsage';

interface RadarUsageBadgeProps {
  usage: RadarUsage;
  compact?: boolean;
}

const LEVEL_STYLE: Record<RadarLevel, { box: string; dot: string; label: string }> = {
  ok: { box: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', label: 'OK' },
  atencao: { box: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500', label: 'Atenção' },
  estouro: { box: 'bg-rose-50 border-rose-200 text-rose-800', dot: 'bg-rose-500', label: 'Estouro' },
  sem_limite: { box: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400', label: 'Sem limite' },
};

const RULE_NOTE = 'regra a validar com despachante/tributarista';

function usd(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** Aviso do uso do limite Radar (nunca bloqueia). */
export const RadarUsageBadge: React.FC<RadarUsageBadgeProps> = ({ usage, compact = false }) => {
  const style = LEVEL_STYLE[usage.level] || LEVEL_STYLE.sem_limite;
  const period = usage.window === 'calendar' ? 'semestre' : '6 meses';
  const limit = usage.limitUsd != null ? usd(usage.limitUsd) : 'sem limite';
  // pct é fração (0,9 = 90%)
  const pct = usage.pct != null ? ` · ${Math.round(usage.pct * 100)}%` : '';
  const text = `usado US$ ${usd(usage.usedUsd)} / ${limit} (${period})${pct}`;
  const missing = usage.missingValue.length;
  const missingText = missing ? `${missing} processo(s) sem valor` : null;

  if (compact) {
    return (
      <span
        title={`${style.label} · base ${usage.basis.toUpperCase()} · ${usage.windowFrom} a ${usage.windowTo} · ${RULE_NOTE}`}
        className={`inline-flex flex-col gap-0.5 px-2 py-1 rounded-lg border text-[10px] leading-tight ${style.box}`}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
          {text}
        </span>
        {missingText ? <span>{missingText}</span> : null}
        <span className="opacity-70 italic">{RULE_NOTE}</span>
      </span>
    );
  }

  return (
    <div className={`rounded-xl border p-3 text-xs space-y-1 ${style.box}`}>
      <div className="flex items-center gap-2 font-bold">
        <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
        Radar · {style.label}
      </div>
      <div className="font-semibold">{text}</div>
      <div className="text-[11px] opacity-80">
        Base {usage.basis.toUpperCase()} · janela {usage.windowFrom} a {usage.windowTo} · {usage.counted.length}{' '}
        processo(s) contado(s)
      </div>
      {missingText ? <div className="text-[11px] font-semibold">{missingText}</div> : null}
      <div className="text-[10px] italic opacity-70 border-t border-current/20 pt-1">{RULE_NOTE}</div>
    </div>
  );
};
