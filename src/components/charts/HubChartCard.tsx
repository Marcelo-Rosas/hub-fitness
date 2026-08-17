import React from 'react';

export const HubChartCard: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  plotClassName?: string;
}> = ({ title, subtitle, badge, legend, children, className = '', plotClassName = 'h-100 w-full pt-2' }) => {
  return (
    <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {badge ? (
          <span className="shrink-0 px-3 py-1 bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-full text-xs font-mono font-black">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={plotClassName}>{children}</div>
      {legend ? <div className="flex flex-wrap gap-2 pt-1">{legend}</div> : null}
    </div>
  );
};

export const HubAreaGradient: React.FC<{
  id: string;
  from?: string;
  to?: string;
}> = ({ id, from = '#0284c7', to = '#06b6d4' }) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={from} stopOpacity={0.45} />
    <stop offset="95%" stopColor={to} stopOpacity={0.05} />
  </linearGradient>
);
