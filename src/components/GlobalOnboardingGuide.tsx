import React, { useState, useEffect } from 'react';
import { usePlanner } from '../context/PlannerContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Percent,
  GitCompare,
  Layers,
  Building2,
  Settings,
  ShoppingBag,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface GlobalOnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ROUTE_GUIDES = [
  {
    id: 'overview',
    moduleCode: 'VISÃO GERAL',
    title: 'Boas-Vindas à Plataforma HUB-FITNESS 3PL Planner v3.5',
    icon: Sparkles,
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    summary:
      'Modelagem financeira e planejamento estratégico 3PL especializado na operação logística de equipamentos fitness heavy-duty.',
    description:
      'Esta plataforma foi desenvolvida para simulação executiva de viabilidade econômica (24 a 60 meses), governança tributária (Simples Nacional Anexo III) e planejamento de capacidade operacional.',
    keyFeatures: [
      'Simulação de DRE 100% Reativa com CRUD Granular por Plano de Contas e Centro de Custo.',
      'Acompanhamento do Fator R em tempo real para manter alíquota efetiva reduzida de ~6% no Anexo III.',
      'Análise de Sensibilidade e Comparador de Cenários (Baseline x Pessimista x Expansão).',
      'Assistente IA CFO Integrado (powered by Gemini) e Gerador de Relatório PDF Auditável.',
      'Assistente de Compras com cotações em SP, PR e SC (Stretch, Paletes PBR e Empilhadeiras).',
    ],
    recommendedAction: 'Explore os módulos pelo menu lateral ou siga o tour guiado sequencial abaixo.',
  },
  {
    id: 'M1',
    moduleCode: 'MÓDULO M1',
    title: 'M1 · Dashboard Executivo & Matriz TCO',
    icon: BarChart3,
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    summary:
      'Visão macro de indicadores financeiros, curva de caixa acumulado e comparação TCO (SANCO In-house vs 3PL).',
    description:
      'No Módulo M1 você visualiza os KPIs consolidados da operação 3PL ao longo de 24 meses, incluindo Receita Bruta Acumulada, Lucro Líquido, Saldo M24, CAPEX e o comparativo de economia do cliente SANCO terceirizando para a 3PL.',
    keyFeatures: [
      'Curva de Caixa Acumulado (24m, 36m e 60m) com indicação de ponto de inflexão e Payback.',
      'Matriz TCO Comparativa SANCO In-house (R$ 83,8k/mês) x 3PL Fitness (R$ 43,2k/mês).',
      'Termômetro dinâmico do Fator R com alerta de conformidade Anexo III.',
    ],
    recommendedAction: 'Use o M1 para apresentações executivas e validação rápida do ROI e Payback da operação.',
  },
  {
    id: 'M2',
    moduleCode: 'MÓDULO M2',
    title: 'M2 · DRE Granular 24m & Gráfico de Variância',
    icon: TrendingUp,
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    summary:
      'Demonstração do Resultado do Exercício com CRUD granular, Plano de Contas, Centros de Custo e Gráfico de Variância Baseline x Modificado.',
    description:
      'O M2 é o coração financeiro da plataforma. Permite cadastrar, editar, desativar e vincular cada linha de receita, custo operacional (COGS) e despesa (OPEX) ao Plano de Contas Contábil e Centro de Custo.',
    keyFeatures: [
      'CRUD 100% Granular com atualização reativa instantânea de todas as projeções.',
      'Vínculo de cada linha ao Plano de Contas Referencial (ex: 4.1.01.01, 5.1.01.01) e Centro de Custo (CC 001 a CC 005).',
      'Gráfico de Variância (Baseline x Atualmente Modificado): compare graficamente as alterações feitas pelo usuário em relação ao plano de negócios original.',
      'Filtro por Seção (Receita, Custo, Despesa), Tipo (Fixo, Variável) e Busca Livre.',
    ],
    recommendedAction: 'Altere ou crie novas linhas no DRE para simular novas receitas ou custos específicos da sua operação.',
  },
  {
    id: 'M3',
    moduleCode: 'MÓDULO M3',
    title: 'M3 · Cadastro financeiro',
    icon: DollarSign,
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    summary:
      'Ledger de Receita, Custo e Despesa (Ano 1 / Ano 2). Única tela de edição; M2 permanece leitura. VAS e pisos SANCO estão no M14 CPQ.',
    description:
      'Defina os preços unitários e volumes projetados para cada modalidade de serviço logístico 3PL prestado aos clientes fitness.',
    keyFeatures: [
      '6 Drivers Principais: Armazenagem PBR, Handling, Desova FCL 40, Kitting B2C, Ad Valorem Seguro e Gestão WMS/TMS.',
      'Simulador de Rampa de Utilização para M1-M6, M7-M12 e M13-M24.',
      'Sincronização direta com a linha de receita da DRE.',
    ],
    recommendedAction: 'Ajuste os valores das tarifas unitárias para recalcular a projeção de faturamento por serviço.',
  },
  {
    id: 'M4',
    moduleCode: 'MÓDULO M4',
    title: 'M4 · Fluxo de Caixa Detalhado 24/36m',
    icon: PieChart,
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    summary:
      'Demonstração dos Fluxos de Caixa (DFC), projeção de saldo bancário acumulado e ciclo de capital de giro.',
    description:
      'Acompanhe as entradas de caixa, deduções fiscais, saídas operacionais e amortizações de investimentos para garantir liquidez em todos os meses.',
    keyFeatures: [
      'Visão M1 a M36 com detalhamento mensal de entradas e saídas.',
      'Indicadores de Capital de Giro e Saldo Mínimo de Segurança.',
      'Análise de Inflexão de Caixa e Ponto de Equilíbrio (Break-even).',
    ],
    recommendedAction: 'Verifique se há vales de caixa negativos no primeiro ano e ajuste prazos ou investimentos.',
  },
  {
    id: 'M5',
    moduleCode: 'MÓDULO M5',
    title: 'M5 · Fator R & Governança Tributária',
    icon: Percent,
    badgeColor: 'bg-[#C6EFCE] text-[#006100] border-[#006100]/30',
    summary:
      'Monitoramento dinâmico da relação Folha / Receita para enquadramento no Anexo III do Simples Nacional (~6%).',
    description:
      'Evite o reenquadramento no Anexo V (alíquota inicial de 15,5%) mantendo a razão de folha de pagamento sobre receita bruta acumulada dentro da banda ideal de 28,0% a 28,7%.',
    keyFeatures: [
      'Termômetro visual do Fator R com alerta em tempo real.',
      'Simulador de Pró-labore dos Sócios para calibragem do Fator R.',
      'Calculadora de Economia Tributária acumulada x Anexo V (R$ +180k economizados em 24 meses).',
    ],
    recommendedAction: 'Utilize a função "Ajuste Automático do Pró-labore" se o Fator R cair abaixo de 28,0%.',
  },
  {
    id: 'M6',
    moduleCode: 'MÓDULO M6',
    title: 'M6 · Matriz de Cenários & Sensitivity Stress',
    icon: GitCompare,
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    summary:
      'Comparador lado a lado de cenários financeiros (Oficial Baseline, Pessimista e Expansão).',
    description:
      'Crie e compare múltiplos cenários de ocupação física e precificação, analisando o impacto no Lucro Líquido e Saldo M24.',
    keyFeatures: [
      'Comparativo lado a lado de Ocupação, Receita, EBITDA, Saldo M24 e Fator R.',
      'Ferramenta para duplicar ou criar novos cenários personalizados.',
      'Gráficos comparativos de curva de caixa por cenário.',
    ],
    recommendedAction: 'Crie um novo cenário com 50% de ocupação para avaliar a resiliência financeira em momentos de crise.',
  },
  {
    id: 'M7',
    moduleCode: 'MÓDULO M7',
    title: 'M7 · Planejamento de Capacidade Ano 3 & Expansão',
    icon: Layers,
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    summary:
      'Análise de capacidade física do galpão (posições palete, docas, empilhadeiras) para M25-M36.',
    description:
      'Acompanhe a taxa de ocupação estática e dinâmica para anteceder gargalos operacionais e planejar a expansão do Galpão B.',
    keyFeatures: [
      'Simulação de expansão física de 1.200m² para 2.400m².',
      'Indicadores de produtividade por m² e utilização de posições palete.',
      'Plano de Mitigação de Gargalos de Pátio e Docas.',
    ],
    recommendedAction: 'Análise a projeção de saturação do galpão no M31 para agendar a locação do módulo adicional.',
  },
  {
    id: 'M8',
    moduleCode: 'MÓDULO M8',
    title: 'M8 · Projeção 60 Meses & Spin-Off Valuation',
    icon: Building2,
    badgeColor: 'bg-[#1F3864] text-white border-blue-900',
    summary:
      'Projeção de longo prazo (5 anos), valuation por Múltiplo de EBITDA/DCF e estruturação de Spin-off.',
    description:
      'Avalie o potencial de criação de valor da unidade de negócios 3PL como uma empresa autônoma para atração de investidores ou M&A.',
    keyFeatures: [
      'Valuation estimado por Múltiplo de EBITDA (6.5x) e DCF (Desconto de Fluxo de Caixa).',
      'Projeção de demonstrativos simplificados para Anos 1 a 5 (60 meses).',
      'Análise de atratividade para fundos de Private Equity e operadores logísticos.',
    ],
    recommendedAction: 'Simule o valor da empresa no Ano 5 para apresentações de captação de recursos.',
  },
  {
    id: 'M9',
    moduleCode: 'MÓDULO M9',
    title: 'M9 · Governança, Trilha de Auditoria & Exportação',
    icon: Settings,
    badgeColor: 'bg-slate-200 text-slate-800 border-slate-400',
    summary:
      'Central de governança corporativa, registro imutável de alterações, exportação XLSX e relatórios PDF.',
    description:
      'Mantenha a transparência e auditabilidade do modelo. Exporte relatórios executivos em PDF com assinatura técnica ou planilhas estruturadas.',
    keyFeatures: [
      'Trilha de Auditoria com log de quem, quando e o que alterou cada premissa.',
      'Trava de validação das constantes regulatórias e fiscais.',
      'Exportação para Google Drive e download de relatório executivo em PDF formatado.',
    ],
    recommendedAction: 'Acesse o M9 antes de reuniões com conselho para emitir a versão oficial do relatório.',
  },
  {
    id: 'M10',
    moduleCode: 'MÓDULO M10',
    title: 'M10 · Assistente de Compras & Cotação de Fornecedores',
    icon: ShoppingBag,
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    summary:
      'Gestão de cotações para suprimentos e equipamentos operacionais nos estados de SP, PR e SC.',
    description:
      'Compare cotações de fornecedores regionais para Filme Stretch, Paletes PBR/HT e Locação de Empilhadeiras, aplicando automaticamente os melhores preços no DRE.',
    keyFeatures: [
      'Comparativo de custos com frete regional incluído (SP, PR, SC).',
      'Identificação da Cotação Vencedora Recomendada.',
      'Botão "Aplicar ao DRE" para sincronizar instantaneamente os custos com a DRE granular.',
    ],
    recommendedAction: 'Selecione e aplique as cotações recomendadas para otimizar os custos operacionais (COGS).',
  },
];

export const GlobalOnboardingGuide: React.FC<GlobalOnboardingGuideProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule } = usePlanner();
  const [activeTabId, setActiveTabId] = useState<string>('overview');

  // Sync tab with activeModule when opened or changed
  useEffect(() => {
    if (activeModule && isOpen && activeTabId === 'overview') {
      const found = ROUTE_GUIDES.find((g) => g.id === activeModule);
      if (found) {
        // Option to default to current module or overview
      }
    }
  }, [activeModule, isOpen]);

  if (!isOpen) return null;

  const currentGuide = ROUTE_GUIDES.find((g) => g.id === activeTabId) || ROUTE_GUIDES[0];
  const currentIndex = ROUTE_GUIDES.findIndex((g) => g.id === activeTabId);

  const handleNext = () => {
    if (currentIndex < ROUTE_GUIDES.length - 1) {
      setActiveTabId(ROUTE_GUIDES[currentIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActiveTabId(ROUTE_GUIDES[currentIndex - 1].id);
    }
  };

  const handleGoToModule = (modId: string) => {
    if (modId !== 'overview') {
      setActiveModule(modId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* MODAL HEADER */}
        <div className="bg-[#1F3864] text-white p-5 flex items-center justify-between shrink-0 border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <BookOpen className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 uppercase tracking-wider">
                  Guia do Usuário & Onboarding
                </span>
                <span className="text-[10px] text-blue-200 font-mono">v3.5 · HUB-FITNESS 3PL</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white mt-0.5">
                Orientação Visual da Plataforma & Rotas
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Fechar Guia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY CONTAINER WITH NAVIGATION SIDEBAR & DETAIL PANEL */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50">
          {/* ROUTE SELECTOR TABS (LEFT SIDEBAR) */}
          <div className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto p-2 space-y-1 max-h-48 md:max-h-full">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Selecione a Rota / Módulo</span>
              <span>{ROUTE_GUIDES.length} Guias</span>
            </div>

            {ROUTE_GUIDES.map((guide, idx) => {
              const Icon = guide.icon;
              const isActive = guide.id === activeTabId;
              const isCurrentActiveModule = guide.id === activeModule;

              return (
                <button
                  key={guide.id}
                  onClick={() => setActiveTabId(guide.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-between gap-2.5 border ${
                    isActive
                      ? 'bg-[#1F3864] text-white border-[#1F3864] shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold truncate text-[11px]">{guide.moduleCode}</div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                        {guide.title.split('·')[1] || guide.title}
                      </div>
                    </div>
                  </div>

                  {isCurrentActiveModule && guide.id !== 'overview' && (
                    <span className="shrink-0 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Atual
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* DETAIL CONTENT PANEL */}
          <div className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6 bg-slate-50">
            {/* Module Badge & Header */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span
                  className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${currentGuide.badgeColor}`}
                >
                  {currentGuide.moduleCode}
                </span>

                {currentGuide.id !== 'overview' && (
                  <button
                    onClick={() => handleGoToModule(currentGuide.id)}
                    className="px-3.5 py-1.5 bg-[#1F3864] hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ir para {currentGuide.moduleCode}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                {currentGuide.title}
              </h3>

              <p className="text-sm font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {currentGuide.summary}
              </p>

              <p className="text-xs text-slate-600 leading-relaxed">{currentGuide.description}</p>
            </div>

            {/* Key Features / Highlights */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Principais Funcionalidades & O que Observar:</span>
              </h4>

              <div className="space-y-2.5">
                {currentGuide.keyFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-700 font-medium leading-normal">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Action / Tip Box */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-blue-900">Orientação de Uso Recomendada:</h5>
                <p className="text-xs text-blue-800 mt-1">{currentGuide.recommendedAction}</p>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER CONTROLS */}
        <div className="bg-white p-4 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                currentIndex === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              Passo {currentIndex + 1} de {ROUTE_GUIDES.length}
            </span>

            <button
              onClick={handleNext}
              disabled={currentIndex === ROUTE_GUIDES.length - 1}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                currentIndex === ROUTE_GUIDES.length - 1
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
              }`}
            >
              <span>Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentGuide.id !== 'overview' && (
              <button
                onClick={() => handleGoToModule(currentGuide.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Navegar para {currentGuide.moduleCode}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all cursor-pointer"
            >
              Concluir Guia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
