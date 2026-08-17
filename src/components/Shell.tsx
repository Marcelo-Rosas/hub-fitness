import React, { useState, useEffect, useMemo } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { projectYear3Baseline } from '../core/year3Plan';
import { RoleLoginModal } from './RoleLoginModal';
import { GeminiAdvisorModal } from './GeminiAdvisorModal';
import { HubFitnessLogo } from './HubFitnessLogo';
import { StructuredPdfReportModal } from './StructuredPdfReportModal';
import { ModuleReportGenerator } from './ModuleReportGenerator';
import { GlobalOnboardingGuide } from './GlobalOnboardingGuide';
import TopBar from './TopBar';
import { USER_ROLES } from '../data/initialData';
import { canViewModule, firstVisibleModule } from '../core/rbac/moduleVisibility';
import { visibleArticles } from '../core/kb/visibility';
import { saveFileToGoogleDrive } from '../utils/googleDrive';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Percent,
  GitCompare,
  Layers,
  Settings,
  Lock,
  Unlock,
  AlertTriangle,
  Building2,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sliders,
  ShieldCheck,
  Target,
  FileCheck,
  Users,
  BookOpen,
  Scale,
  Truck,
  Globe,
  Inbox,
  HelpCircle,
} from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const {
    activeModule,
    setActiveModule,
    activeRole,
    user,
    logout,
    pitchMode,
    setPitchMode,
    activeScenario,
    fatorR,
    dreMonths,
    hubParams,
    blockedValueAttempt,
    clearBlockedAttempt,
    createNewScenario,
    addAuditLog,
  } = usePlanner();

  const rbt12 = useMemo(() => {
    return dreMonths.slice(-12).reduce((acc, m) => acc + m.receitaServicos, 0);
  }, [dreMonths]);

  const year3Status = useMemo(() => projectYear3Baseline(hubParams, true), [hubParams]);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState<boolean>(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isModuleReportOpen, setIsModuleReportOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isNewScenarioModalOpen, setIsNewScenarioModalOpen] = useState<boolean>(false);
  const [newScenarioName, setNewScenarioName] = useState<string>('');
  const [newScenarioOccupancy, setNewScenarioOccupancy] = useState<number>(80);
  const [driveExportStatus, setDriveExportStatus] = useState<string | null>(null);

  // Auto-open onboarding on first visit or show trigger
  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenOnboarding_v35');
    if (!hasSeen) {
      setIsOnboardingOpen(true);
    }
  }, []);

  // Accordion Group collapse states
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    executivo: true,
    financeiro: true,
    comercial: true,
    logistica: true,
    compras: true,
    intranet: true,
    comex: true,
    estrategia: true,
    referencia: true,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const rawModuleGroups = [
    {
      id: 'executivo',
      label: '📊 Executivo',
      icon: BarChart3,
      items: [
        { id: 'M1', label: 'Dashboard Executivo', icon: BarChart3 },
        { id: 'M9', label: 'Governança & Exportação', icon: Settings },
      ],
    },
    {
      id: 'financeiro',
      label: '💰 Financeiro',
      icon: DollarSign,
      items: [
        { id: 'M2', label: 'DRE Granular 24m', icon: TrendingUp },
        { id: 'M3', label: 'Cadastro financeiro', icon: DollarSign },
        { id: 'M4', label: 'Fluxo de Caixa', icon: PieChart },
        { id: 'M5', label: 'Fator R & Tributos', icon: Percent },
        { id: 'M6', label: 'Mix & Cenários', icon: Sliders },
        { id: 'M11', label: 'Plano de Contas', icon: BookOpen },
        { id: 'M15', label: 'RH & Custos SC', icon: Users },
      ],
    },
    {
      id: 'comercial',
      label: '🎯 Comercial',
      icon: Target,
      items: [
        { id: 'M13', label: 'CRM Pipeline 180d', icon: Target },
        { id: 'M14', label: 'Propostas CPQ', icon: FileCheck },
        { id: 'M16', label: 'Benchmark Custos', icon: Scale },
      ],
    },
    {
      id: 'logistica',
      label: '📦 Logística',
      icon: Truck,
      items: [
        { id: 'M17', label: 'Simulador Anexo V', icon: Layers },
        { id: 'M12', label: 'Contratos & SLAs', icon: ShieldCheck },
      ],
    },
    {
      id: 'compras',
      label: '🛒 Compras',
      icon: ShoppingBag,
      items: [{ id: 'M10', label: 'Compras & Fornecedores', icon: ShoppingBag }],
    },
    {
      id: 'intranet',
      label: '🏢 Intranet',
      icon: Inbox,
      items: [{ id: 'M19', label: 'Aprovações entre setores', icon: Inbox }],
    },
    {
      id: 'comex',
      label: '🌐 Comex',
      icon: Globe,
      items: [{ id: 'M18', label: 'PUCOMEX & Processos', icon: Globe }],
    },
    {
      id: 'estrategia',
      label: '🔮 Estratégia',
      icon: Sparkles,
      items: [
        { id: 'M7', label: 'Expansão Ano 3', icon: Layers },
        { id: 'M8', label: 'Visão 60m & Spin-off', icon: Building2 },
      ],
    },
    {
      id: 'referencia',
      label: 'Referência',
      icon: BookOpen,
      items: [{ id: 'KB', label: 'Base de conhecimento', icon: HelpCircle }],
    },
  ];

  const kbCount = visibleArticles(activeRole).length;

  // Visibilidade RBAC — matriz MODULE_VISIBILITY
  const moduleGroups = rawModuleGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canViewModule(activeRole, item.id)) return false;
        if (item.id === 'KB' && kbCount === 0) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    if (!canViewModule(activeRole, activeModule)) {
      setActiveModule(firstVisibleModule(activeRole));
    }
  }, [activeRole, activeModule, setActiveModule]);

  // Ensure group containing activeModule is open
  useEffect(() => {
    moduleGroups.forEach((grp) => {
      if (grp.items.some((item) => item.id === activeModule)) {
        setOpenGroups((prev) => ({ ...prev, [grp.id]: true }));
      }
    });
  }, [activeModule]);

  const currentRoleConfig = USER_ROLES.find((r) => r.id === activeRole);

  const handleCreateScenarioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;
    createNewScenario(newScenarioName, newScenarioOccupancy / 100);
    setNewScenarioName('');
    setIsNewScenarioModalOpen(false);
  };

  const handleDriveExport = async () => {
    setDriveExportStatus('Exportando relatório para o Google Drive...');
    const reportText = `HUB-FITNESS · 3PL LOGISTICS PLANNER - RELATÓRIO EXECUTIVO v3.5
======================================================
Cenário: ${activeScenario.name}
Data de Exportação: ${new Date().toLocaleString('pt-BR')}

RESUMO FINANCEIRO (24 MESES):
-----------------------------
- Receita Bruta 24m: R$ ${dreMonths.reduce((a, b) => a + b.receitaServicos, 0).toLocaleString('pt-BR')}
- Lucro Líquido 24m: R$ ${dreMonths.reduce((a, b) => a + b.lucroLiquido, 0).toLocaleString('pt-BR')}
- Fator R Médio: ${fatorR}% (Banda Alvo 28,0% - 28,7%)
- Saldo M24: R$ ${activeScenario.m24Cash.toLocaleString('pt-BR')}
- CAPEX Total: R$ ${activeScenario.capexTotal.toLocaleString('pt-BR')}

Status de Governança:
- Validação 425k/789k/21,7%/804k: Auditado e Aprovado
- Base de Cálculo: Simples Nacional Anexo III
`;

    const res = await saveFileToGoogleDrive({
      filename: `HUB-FITNESS_Relatorio_${activeScenario.name.replace(/\s+/g, '_')}.txt`,
      mimeType: 'text/plain',
      content: reportText,
    });

    if (res.success) {
      setDriveExportStatus(`✅ Exportado com sucesso para o Google Drive! (ID: ${res.fileId})`);
    } else {
      setDriveExportStatus(`⚠️ ${res.error}`);
    }

    setTimeout(() => setDriveExportStatus(null), 8000);
  };

  return (
    <div className="min-h-screen bg-canvas-bg flex flex-col font-sans antialiased text-gray-800">
      {/* MAIN CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside
          className={`${
            isSidebarCollapsed ? 'w-17' : 'w-55'
          } bg-[#1F3864] text-white flex flex-col shrink-0 transition-all duration-300 relative group z-40`}
        >
          {/* Header & Logo */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between min-h-15">
            {!isSidebarCollapsed ? (
              <HubFitnessLogo size="sm" variant="dark" />
            ) : (
              <div className="w-full flex justify-center">
                <span className="font-black text-amber-400 text-sm tracking-tighter">HUB</span>
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer"
              title={isSidebarCollapsed ? 'Expandir Menu' : 'Recolher Menu (Colapse)'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="flex-1 py-2 space-y-1.5 overflow-y-auto overflow-x-hidden px-2">
            {moduleGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupOpen = openGroups[group.id];
              const hasActiveChild = group.items.some((item) => item.id === activeModule);

              if (isSidebarCollapsed) {
                // COLLAPSED MODE (Icons Only with Tooltip)
                return (
                  <div key={group.id} className="space-y-1 py-1 border-b border-white/5 last:border-none">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activeModule === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.id === 'KB') {
                              window.history.replaceState(null, '', '?module=KB');
                            }
                            setActiveModule(item.id);
                          }}
                          className={`w-full h-9 flex items-center justify-center rounded-lg transition-all relative group/item cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500/20 text-[#C6EFCE] font-bold border border-emerald-500/40 shadow-xs'
                              : 'text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <ItemIcon className={`w-4 h-4 ${isActive ? 'text-[#C6EFCE]' : 'opacity-80'}`} />
                          
                          {/* FLOATING HOVER TOOLTIP */}
                          <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-md shadow-xl opacity-0 group-hover/item:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                            <span className="font-mono font-bold text-emerald-400 mr-1.5">{item.id}</span>
                            <span>{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              // EXPANDED ACCORDION MODE
              return (
                <div key={group.id} className="rounded-lg overflow-hidden border border-white/5 bg-white/5">
                  {/* ACCORDION GROUP HEADER */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full px-2.5 py-1.5 text-[11px] font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      hasActiveChild ? 'text-emerald-300 bg-white/10' : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{group.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 shrink-0 ${
                        isGroupOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* ACCORDION GROUP ITEMS */}
                  {isGroupOpen && (
                    <div className="py-1 px-1 space-y-0.5 bg-black/20">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = activeModule === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === 'KB') {
                                window.history.replaceState(null, '', '?module=KB');
                              }
                              setActiveModule(item.id);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 text-[11.5px] rounded-md flex items-center justify-between transition-all cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/20 text-[#C6EFCE] font-bold border border-emerald-500/30 shadow-xs'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#C6EFCE]' : 'opacity-60'}`} />
                              <span className="truncate">{item.label}</span>
                            </div>
                            <span className={`text-[9.5px] font-mono px-1 rounded ${isActive ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-white/40'}`}>
                              {item.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Fator R Gauge Micro-Widget in Sidebar */}
          {!isSidebarCollapsed ? (
            <div className="p-3 bg-white/5 border-t border-white/10 m-3 rounded-lg">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/70 mb-1">
                <span>Fator R Atual</span>
                <span className={fatorR >= 28.0 && fatorR <= 28.7 ? 'text-[#C6EFCE] font-bold' : 'text-yellow-300 font-bold'}>
                  {fatorR}%
                </span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    fatorR >= 28.0 && fatorR <= 28.7 ? 'bg-[#C6EFCE]' : 'bg-yellow-400'
                  }`}
                  style={{ width: `${Math.min(100, (fatorR / 35) * 100)}%` }}
                ></div>
              </div>
              <div className="text-[9.5px] text-white/50 mt-1 flex justify-between">
                <span>Alvo: 28,0% – 28,7%</span>
                <span>Anexo III</span>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t border-white/10 flex flex-col items-center justify-center text-[10px] text-[#C6EFCE] font-bold font-mono">
              <span>{fatorR}%</span>
            </div>
          )}

          <div className="p-3 border-t border-white/10">
            <div className={`flex items-center gap-2 text-white/60 text-[11px] ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0"></div>
              {!isSidebarCollapsed && (
                <span className="truncate">Sessão: {currentRoleConfig?.name.split(' ')[0]} · v3.5</span>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN BODY AREA */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <TopBar
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onOpenRoleModal={() => setIsRoleModalOpen(true)}
            onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
            onOpenPdfModal={() => setIsPdfModalOpen(true)}
            onOpenModuleReport={() => setIsModuleReportOpen(true)}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenNewScenario={() => setIsNewScenarioModalOpen(true)}
            onDriveExport={handleDriveExport}
          />

          {/* Drive Export Toast Status Banner */}
          {driveExportStatus && (
            <div className="bg-[#1F3864] text-white px-4 py-2 text-xs font-mono flex items-center justify-between border-b border-blue-900 animate-in slide-in-from-top shrink-0">
              <span>{driveExportStatus}</span>
              <button onClick={() => setDriveExportStatus(null)} className="text-blue-200 hover:text-white">✕</button>
            </div>
          )}

          {/* Blocked Attempt Toast Alert */}
          {blockedValueAttempt && (
            <div className="bg-rose-900 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b border-rose-800 animate-in fade-in shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{blockedValueAttempt}</span>
              </div>
              <button
                onClick={clearBlockedAttempt}
                className="px-2 py-0.5 bg-rose-800 hover:bg-rose-700 rounded text-[11px]"
              >
                Entendido
              </button>
            </div>
          )}

          {/* Persistent Pitch Mode Governança Banner */}
          {pitchMode && (
            <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between border-b border-amber-600 shadow-xs shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-950 animate-pulse shrink-0" />
                <span>
                  🔒 <strong>PITCH MODE ATIVO (TRAVA DE GOVERNANÇA CORPORATIVA)</strong>: Todos os inputs e drivers do modelo financeiro estão congelados para apresentação oficial ao Board.
                </span>
              </div>
              <button
                onClick={() => {
                  if (confirm('Deseja desativar o Pitch Mode e liberar a edição dos drivers de projeção financeira?')) {
                    setPitchMode(false);
                    addAuditLog('Pitch Mode', 'Ativo', 'Desbloqueado pelo Usuário');
                  }
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded text-[11px] font-extrabold flex items-center gap-1 shadow-xs cursor-pointer shrink-0 ml-2"
              >
                <Unlock className="w-3 h-3 text-amber-400" />
                <span>Desbloquear Governança</span>
              </button>
            </div>
          )}

          {/* CONTENT VIEWPORT */}
          <main className="flex-1 p-6 space-y-6 overflow-y-auto bg-canvas-bg">
            {children}
          </main>

          {/* GLOBAL FOOTER BAR */}
          <footer className="h-12.5 bg-slate-header text-white flex items-center px-6 gap-6 shrink-0 z-20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Status de Alertas:</span>
            </div>

            <div className="flex-1 flex gap-4 overflow-x-auto">
              <div
                onClick={() => setActiveModule('M5')}
                className="flex items-center gap-1.5 bg-black/10 px-3 py-1 rounded text-[11px] cursor-pointer hover:bg-black/20 transition-colors"
              >
                <span className="text-gray-300 font-medium">Fator R:</span>
                <span className="font-bold text-green-300">{fatorR}% (OK)</span>
              </div>

              <div
                onClick={() => setActiveModule('M8')}
                className="flex items-center gap-1.5 bg-black/10 px-3 py-1 rounded text-[11px] cursor-pointer hover:bg-black/20 transition-colors"
              >
                <span className="text-gray-300 font-medium">RBT12:</span>
                <span className="font-bold text-yellow-300">
                  R$ {(rbt12 / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}M
                </span>
              </div>

              <div
                onClick={() => setActiveModule('M7')}
                className="flex items-center gap-1.5 bg-black/10 px-3 py-1 rounded text-[11px] cursor-pointer hover:bg-black/20 transition-colors"
              >
                <span className="text-gray-300 font-medium">Vale {year3Status.valley.month}:</span>
                <span className="font-bold text-gray-300">
                  {year3Status.mitigated ? 'Mitigado' : 'Atenção'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-white/50 italic hidden sm:block">
              Fonte: Simulação auditável v3.5 (Decreto 21,7% ref.)
            </div>
          </footer>
        </div>
      </div>

      {/* Role Selection Modal */}
      <RoleLoginModal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} />

      {/* Gemini CFO AI Advisor Modal */}
      <GeminiAdvisorModal isOpen={isGeminiModalOpen} onClose={() => setIsGeminiModalOpen(false)} />

      {/* Structured PDF Report Modal */}
      <StructuredPdfReportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />

      {/* Global Onboarding & Route Guide Modal */}
      <GlobalOnboardingGuide
        isOpen={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          localStorage.setItem('hasSeenOnboarding_v35', 'true');
        }}
      />

      {/* New Scenario Modal */}
      {isNewScenarioModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">＋ Criar Novo Cenário Financeiro</h3>
            <p className="text-xs text-slate-500 mb-4">Defina as premissas de ocupação para simulação.</p>

            <form onSubmit={handleCreateScenarioSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Cenário</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Expansão Galpão B"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taxa de Ocupação M7+: {newScenarioOccupancy}%
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={newScenarioOccupancy}
                  onChange={(e) => setNewScenarioOccupancy(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>20% (Pessimista)</span>
                  <span>75% (Base v3.5)</span>
                  <span>100% (Capacidade Máxima)</span>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewScenarioModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded shadow-xs"
                >
                  Criar e Simular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODULE CANONICAL REPORT MODAL */}
      <ModuleReportGenerator
        moduleId={activeModule}
        isOpen={isModuleReportOpen}
        onClose={() => setIsModuleReportOpen(false)}
      />
    </div>
  );
};
