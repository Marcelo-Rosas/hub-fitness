import React from 'react';

/** Visual SSOT = Curva de Saldo M4 Fluxo Puro. */
export const HUB_CHART = {
  stroke: '#0284c7',
  strokeAlt: '#06b6d4',
  strokeMuted: '#94a3b8',
  fillFrom: '#0284c7',
  fillTo: '#06b6d4',
  grid: '#f1f5f9',
  tick: '#64748b',
  zero: '#94a3b8',
  capex: '#ef4444',
  vale: '#f59e0b',
  payback: '#0284c7',
  rent: '#6366f1',
  downside: '#f43f5e',
  upside: '#0284c7',
} as const;

export const hubTick = { fontSize: 11, fill: HUB_CHART.tick };
export const hubTooltipStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderColor: '#1e293b',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

export function hubYAxisK(val: number): string {
  return `R$ ${(val / 1000).toFixed(0)}k`;
}

/** Rótulo curto no topo da ReferenceLine. */
export function markerLabel(text: string, fill: string, dy: number) {
  return (props: { viewBox?: { x?: number; y?: number } }) => {
    const x = props.viewBox?.x;
    if (x == null) return null;
    const w = Math.max(42, text.length * 6.2 + 12);
    return (
      <g transform={`translate(${x}, ${dy})`}>
        <rect x={-w / 2} y={-11} width={w} height={16} rx={4} fill="#fff" stroke={fill} strokeWidth={1} opacity={0.96} />
        <text textAnchor="middle" y={1} fill={fill} fontSize={9} fontWeight={700}>
          {text}
        </text>
      </g>
    );
  };
}

export const HubChartLegendPill: React.FC<{
  tone: 'rose' | 'amber' | 'sky' | 'indigo' | 'slate';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const cls: Record<typeof tone, string> = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${cls[tone]}`}>{children}</span>
  );
};
