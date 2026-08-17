import React, { useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { USER_ROLES } from '../data/initialData';
import { exportDre24mCSV } from '../utils/exportHandlers';
import {
  Download,
  Plus,
  FileSpreadsheet,
  FileText,
  CloudUpload,
  Link,
  ChevronDown,
  Sparkles,
  Printer,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
} from 'lucide-react';

interface TopBarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenRoleModal: () => void;
  onOpenGeminiModal: () => void;
  onOpenPdfModal: () => void;
  onOpenNewScenario: () => void;
  onDriveExport: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenRoleModal,
  onOpenGeminiModal,
  onOpenPdfModal,
  onOpenNewScenario,
  onDriveExport,
}) => {
  const {
    activeModule,
    setActiveModule,
    activeRole,
    pitchMode,
    setPitchMode,
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    activeScenario,
    dreMonths,
    granularDreItems,
  } = usePlanner();

  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isScenarioDropdownOpen, setIsScenarioDropdownOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const currentRoleConfig = USER_ROLES.find((r) => r.id === activeRole);

  return (
    <header className="h-15 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-30">
      {/* Left Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
          title={isSidebarCollapsed ? 'Expandir Sidebar' : 'Recolher Sidebar'}
          aria-label={isSidebarCollapsed ? 'Expandir Sidebar' : 'Recolher Sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-[#1F3864]" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-[#1F3864]" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsScenarioDropdownOpen(!isScenarioDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#FFFBEB] rounded border border-yellow-200 text-xs font-medium hover:bg-yellow-100/50 transition-colors"
          >
            <span className="text-gray-500">Cenário:</span>
            <span className="text-gray-900 font-bold">{activeScenario.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {isScenarioDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                Cenários Disponíveis
              </div>
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveScenarioId(s.id);
                    setIsScenarioDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    s.id === activeScenarioId ? 'bg-gray-100 font-bold text-[#1F3864]' : 'text-gray-700'
                  }`}
                >
                  <span>{s.name}</span>
                  {s.isBaseline && (
                    <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium">
                      Oficial
                    </span>
                  )}
                  {s.id === 'sc-v36-wms-proprio' && (
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-medium">
                      LogTech
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
            className="p-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 cursor-pointer"
            aria-label="Mais ações"
            title="Mais ações"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {isOverflowOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  onOpenNewScenario();
                  setIsOverflowOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo cenário
              </button>
              <button
                type="button"
                onClick={() => {
                  setPitchMode(!pitchMode);
                  setIsOverflowOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-800"
              >
                Pitch Mode {pitchMode ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenGeminiModal();
                  setIsOverflowOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-800"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Assistente CFO IA
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <button
            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
            className="px-3 py-1.5 bg-[#1F3864] text-white rounded text-xs font-medium hover:opacity-90 flex items-center gap-1.5 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {isExportDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-xs text-gray-700">
              <button
                onClick={() => {
                  onOpenPdfModal();
                  setIsExportDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-emerald-700 font-bold"
              >
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Baixar Relatório PDF (HUB-FITNESS)</span>
              </button>
              <button
                onClick={() => {
                  setActiveModule('M9');
                  setIsExportDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Ir para Mód. Exportação M9</span>
              </button>
              <button
                onClick={() => {
                  exportDre24mCSV(dreMonths, activeScenario.name, granularDreItems);
                  setIsExportDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-semibold text-green-800"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                <span>Exportar Planilha CSV / XLSX</span>
              </button>
              <button
                onClick={() => {
                  setIsExportDropdownOpen(false);
                  onDriveExport();
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 text-blue-700 font-semibold"
              >
                <CloudUpload className="w-4 h-4 text-blue-600" />
                <span>Salvar no Google Drive 📁</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link de leitura gerado e copiado para a área de transferência (Validez 72h)!');
                  setIsExportDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
              >
                <Link className="w-4 h-4 text-amber-600" />
                <span>Gerar Link Leitura (72h)</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-gray-200" />

        <div
          onClick={onOpenRoleModal}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="text-right">
            <div className="text-xs font-bold leading-none">{currentRoleConfig?.name}</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">
              {activeRole === 'cfo'
                ? 'Acesso Total'
                : activeRole === 'socio'
                  ? 'Visualização Estratégica'
                  : activeRole === 'comite'
                    ? 'Modo Leitura (Trava 🔒)'
                    : activeRole === 'compras'
                      ? 'Compras & RFQ'
                      : 'Pitch Mode Forçado'}
            </div>
          </div>
          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold border border-gray-200">
            👤
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
