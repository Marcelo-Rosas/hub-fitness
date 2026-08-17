import React, { useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { exportModulePDF, exportModuleCSV } from '../utils/exportHandlers';
import { ModuleReportGenerator } from './ModuleReportGenerator';
import { GeminiAdvisorModal } from './GeminiAdvisorModal';
import { Download, FileText, Sparkles, Printer, HelpCircle } from 'lucide-react';
import type { ModuleId } from '../core/rbac/moduleVisibility';
import { kbHrefForModule } from '../core/kb/visibility';
import { resolvePlannerSearch } from '../core/m6LegacyRoutes';

export interface KpiCardItem {
  label: string;
  value: string | number;
  subtext?: string;
  badge?: string;
  highlightColor?: 'emerald' | 'amber' | 'blue' | 'indigo' | 'slate' | 'rose';
}

interface ModuleHeaderProps {
  moduleId: string;
  title: string;
  subtitle: string;
  kpis?: KpiCardItem[];
  actions?: React.ReactNode;
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  moduleId,
  title,
  subtitle,
  kpis,
  actions,
}) => {
  const { dreMonths, activeScenario, fatorR, granularDreItems, activeRole, setActiveModule } =
    usePlanner();
  const kbHref =
    moduleId !== 'KB' ? kbHrefForModule(activeRole, moduleId as ModuleId) : null;
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  const handlePdfExport = () => {
    exportModulePDF(moduleId, dreMonths, activeScenario, fatorR, granularDreItems);
  };

  const handleCsvExport = () => {
    exportModuleCSV(moduleId, dreMonths, activeScenario, fatorR, granularDreItems);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* HEADER TOP BANNER */}
      <div className="bg-[#1F3864] text-white p-5 rounded-xl shadow-md border border-slate-700 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-linear-to-l from-blue-500/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/30 rounded font-mono text-emerald-300">
              {moduleId}
            </span>
            <span>HUB-SIM · 3PL LOGISTICS PLANNER</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            {title}
            {kbHref && (
              <button
                type="button"
                aria-label="Base de conhecimento"
                title="Base de conhecimento"
                onClick={() => {
                  const route = resolvePlannerSearch(kbHref);
                  window.history.replaceState(null, '', kbHref);
                  setActiveModule(route.module);
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-white/40 text-white/90 hover:bg-white/15 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>
        </div>

        {/* UNIFIED ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2 relative z-10 shrink-0">
          {actions}

          <button
            onClick={handlePdfExport}
            className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Exportar relatório do módulo em PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar PDF</span>
          </button>

          <button
            onClick={handleCsvExport}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Exportar dados do módulo em CSV (Excel Brasil)"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Baixar CSV</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 text-amber-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Abrir visualização do relatório executivo do módulo"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Relatório</span>
          </button>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-2 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Consultar parecer do CFO Virtual Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>Análise IA</span>
          </button>
        </div>
      </div>

      {/* STANDARDIZED UNIFIED KPI CARDS */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => {
            const colorClass =
              kpi.highlightColor === 'emerald'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : kpi.highlightColor === 'amber'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : kpi.highlightColor === 'indigo'
                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                : kpi.highlightColor === 'rose'
                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                : 'bg-white border-slate-200 text-slate-900';

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between ${colorClass}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">
                    {kpi.label}
                  </span>
                  {kpi.badge && (
                    <span className="px-1.5 py-0.5 bg-slate-200/80 text-slate-700 text-[9.5px] font-mono font-bold rounded shrink-0">
                      {kpi.badge}
                    </span>
                  )}
                </div>

                <div className="text-xl font-black font-mono tracking-tight my-0.5">
                  {kpi.value}
                </div>

                {kpi.subtext && (
                  <span className="text-[10px] font-medium text-slate-500 block truncate mt-0.5">
                    {kpi.subtext}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      <ModuleReportGenerator
        moduleId={moduleId}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      <GeminiAdvisorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};
