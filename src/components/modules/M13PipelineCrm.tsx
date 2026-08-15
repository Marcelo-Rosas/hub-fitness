import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  PieChart,
  ArrowRight,
  Sparkles,
  FileText,
  ShieldAlert,
  Building,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';

export const M13PipelineCrm: React.FC = () => {
  const { activeMix, updateActiveMix, pitchMode, dreMonths } = usePlanner();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Status of Anchor Client contract
  const [anchorClientSigned, setAnchorClientSigned] = useState<boolean>(true);

  // CRM Pipeline Leads Simulation State
  const [pipelineLeads, setPipelineLeads] = useState([
    { id: '1', name: 'MaxFitness Equipamentos', profile: 'p4', positions: 220, monthlyRevenue: 18500, probability: 90, status: 'Fechado (Âncora)' },
    { id: '2', name: 'SportWear Brasil E-commerce', profile: 'p5', positions: 150, monthlyRevenue: 14200, probability: 75, status: 'Em Negociação' },
    { id: '3', name: 'Rede Academias PowerFit', profile: 'p2', positions: 180, monthlyRevenue: 12800, probability: 60, status: 'Proposta Enviada' },
    { id: '4', name: 'Importadora Suplementos SC', profile: 'p1', positions: 350, monthlyRevenue: 15000, probability: 40, status: 'Sondagem Inicial' },
  ]);

  // Timeline Checklists
  const [timelineD90, setTimelineD90] = useState({
    cnpjItajai: true,
    simplesEnquadramento: true,
    contratoGalpaoA: true,
    inscricaoEstadual: true,
  });

  const [timelineD60, setTimelineD60] = useState({
    montagemRacksKonnen: true,
    locacaoEmpilhadeiras: true,
    wmsEdiSetup: true,
    alvaraCbmVigilancia: true,
  });

  const [timelineD15, setTimelineD15] = useState({
    anchorContractSigned: anchorClientSigned,
    ediIntegrationTested: true,
    setupFeeReceived: true,
    initialInventoryReceived: true,
  });

  const toggleD90 = (key: keyof typeof timelineD90) => {
    if (pitchMode) return;
    setTimelineD90((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleD60 = (key: keyof typeof timelineD60) => {
    if (pitchMode) return;
    setTimelineD60((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleD15 = (key: keyof typeof timelineD15) => {
    if (pitchMode) return;
    setTimelineD15((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate current mix proportions from activeMix in PlannerContext
  const currentP1 = activeMix.p1;
  const currentP5 = activeMix.p5;
  const isP1AdverseRisk = currentP1 > 50; // Critical risk from 03_Cenarios_Sensibilidade.csv

  const initialRevenueM1 = dreMonths[0]?.receitaServicos || 90600;

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M13"
        title="Plano de Prospecção, Pipeline 180d & Radar de Mix"
        subtitle="Acompanhamento do cronograma de implantação (D-90 a D+30), validação do Cliente-Âncora e monitoramento de riscos de contaminação de mix adverso P1."
        kpis={[
          {
            label: 'Cliente Âncora (20% Op.)',
            value: anchorClientSigned ? 'FECHADO ✓' : 'EM RISCO ⚠️',
            subtext: anchorClientSigned ? 'Contrato assinado em D-15' : 'Gargalo no faturamento M1',
            badge: 'ÂNCORA',
            highlightColor: anchorClientSigned ? 'emerald' : 'rose',
          },
          {
            label: 'Risco de Contaminação P1',
            value: `${currentP1}% P1`,
            subtext: isP1AdverseRisk ? '⚠️ Risco: P1 > 50% reduz margem' : '✓ Mix P1 sob controle (≤ 50%)',
            badge: 'MIX P1',
            highlightColor: isP1AdverseRisk ? 'rose' : 'emerald',
          },
          {
            label: 'Pipeline Oportunidades',
            value: `R$ ${(pipelineLeads.reduce((a, b) => a + b.monthlyRevenue, 0) / 1000).toFixed(1)}k/mês`,
            subtext: `${pipelineLeads.length} Oportunidades qualificadas`,
            badge: 'CRM',
            highlightColor: 'indigo',
          },
          {
            label: 'Meta de Receita M1',
            value: `R$ ${(initialRevenueM1 / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            subtext: 'Rampa operacional D+30',
            badge: 'META M1',
            highlightColor: 'amber',
          },
        ]}
      />

      {/* CRITICAL ALERT BANNER: ANCHOR CLIENT REQUIREMENT */}
      {!anchorClientSigned && (
        <div className="bg-rose-900 text-white p-5 rounded-xl border border-rose-700 shadow-lg animate-in fade-in space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-200 font-extrabold text-sm uppercase tracking-wide">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />
              <span>🚨 ALERTA CRÍTICO DE GOVERNANÇA: M1 SEM CLIENTE-ÂNCORA ASSINADO</span>
            </div>
            <button
              onClick={() => {
                setAnchorClientSigned(true);
                setTimelineD15((prev) => ({ ...prev, anchorContractSigned: true }));
              }}
              className="bg-white hover:bg-rose-100 text-rose-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
            >
              Confirmar Assinatura do Âncora
            </button>
          </div>
          <p className="text-xs text-rose-100 leading-relaxed">
            O Mês M1 exige faturamento inicial mínimo de <strong>R$ {initialRevenueM1.toLocaleString('pt-BR')}</strong> para garantir o ponto de equilíbrio do Galpão A. A operação NÃO PODE ser iniciada sem o contrato do Cliente-Âncora Fitness devidamente chancelado no CRM!
          </p>
        </div>
      )}

      {/* CRITICAL ALERT BANNER: ADVERSE MIX RISK (>50% P1) */}
      {isP1AdverseRisk && (
        <div className="bg-amber-950 text-amber-200 p-5 rounded-xl border border-amber-700 shadow-lg space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm uppercase tracking-wide">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>🔴 ALERTA DE MIX ADVERSO: P1 (ESTOCADOR PURO) ULTRAPASSA 50%</span>
            </div>
            <button
              onClick={() => updateActiveMix({ p1: 20, p2: 30, p4: 25, p5: 25 })}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
            >
              Rebalancear para Blend Alvo (20% P1)
            </button>
          </div>
          <p className="text-xs leading-relaxed text-amber-100">
            Conforme o arquivo oficial <code>03_Cenarios_Sensibilidade.csv</code> (cenário <i>'Mix_adverso_P1_acima_50pct'</i>), elevar o perfil P1 acima de 50% reduz a margem de contribuição média por posição para R$ 52,50, provocando queda do Lucro Líquido M24 para <strong>-R$ 41.100</strong>.
            <strong className="block mt-1 text-white uppercase">Ação Obrigatória: Redirecionar força de vendas para prospecção P4/P5 Premium!</strong>
          </p>
        </div>
      )}

      {/* SECTION 1: IMPLANTATION TIMELINE (D-90 to D+30) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-900" />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                1. Timeline de Implantação e Onboarding (D-90 a D0)
              </h3>
              <p className="text-[11px] text-slate-500">
                Gateways de aprovação para início da operação logística do Galpão A em Itajaí/SC
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-blue-900 bg-blue-50 px-2 py-1 rounded border border-blue-200">
            BP v3.5 · Seção 10
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Phase 1: D-90 to D-60 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">D-90 a D-60 · Societário & Imóvel</span>
              <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">Fase 1</span>
            </div>

            <div className="space-y-2">
              <div
                onClick={() => toggleD90('cnpjItajai')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD90.cnpjItajai ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Abertura CNPJ Filial Itajaí/SC</span>
              </div>

              <div
                onClick={() => toggleD90('simplesEnquadramento')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD90.simplesEnquadramento ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Enquadramento Simples Nacional (Anexo III)</span>
              </div>

              <div
                onClick={() => toggleD90('contratoGalpaoA')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD90.contratoGalpaoA ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Assinatura Locação Galpão A (Carência Aluguel 30d)</span>
              </div>

              <div
                onClick={() => toggleD90('inscricaoEstadual')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD90.inscricaoEstadual ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Inscrição Estadual SEF/SC para 3PL</span>
              </div>
            </div>
          </div>

          {/* Phase 2: D-60 to D-30 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">D-60 a D-30 · Infraestrutura & T.I.</span>
              <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">Fase 2</span>
            </div>

            <div className="space-y-2">
              <div
                onClick={() => toggleD60('montagemRacksKonnen')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD60.montagemRacksKonnen ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Montagem 2.968 Porta-Paletes KONNEN</span>
              </div>

              <div
                onClick={() => toggleD60('locacaoEmpilhadeiras')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD60.locacaoEmpilhadeiras ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Entrega Empilhadeira Retrátil & Patolada</span>
              </div>

              <div
                onClick={() => toggleD60('wmsEdiSetup')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD60.wmsEdiSetup ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Setup WMS / EDI SANCO Integração ERP</span>
              </div>

              <div
                onClick={() => toggleD60('alvaraCbmVigilancia')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD60.alvaraCbmVigilancia ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Alvará de Funcionamento CBM/SC & Habite-se</span>
              </div>
            </div>
          </div>

          {/* Phase 3: D-15 to D0 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">D-15 a D0 · Ramp-up Cliente-Âncora</span>
              <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Fase Crítica</span>
            </div>

            <div className="space-y-2">
              <div
                onClick={() => {
                  const next = !anchorClientSigned;
                  setAnchorClientSigned(next);
                  setTimelineD15((prev) => ({ ...prev, anchorContractSigned: next }));
                }}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-bold text-blue-950"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${anchorClientSigned ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span>Assinatura Contrato Cliente-Âncora Fitness</span>
              </div>

              <div
                onClick={() => toggleD15('ediIntegrationTested')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD15.ediIntegrationTested ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Homologação Teste Pedido B2C/B2B via EDI</span>
              </div>

              <div
                onClick={() => toggleD15('setupFeeReceived')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD15.setupFeeReceived ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Recebimento Setup Fee (R$ 2.500 / SKU)</span>
              </div>

              <div
                onClick={() => toggleD15('initialInventoryReceived')}
                className="flex items-center gap-2 cursor-pointer hover:text-blue-900 font-medium"
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${timelineD15.initialInventoryReceived ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Recebimento Primeiro Lote Inbound (Container)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: RADAR DE MIX DE CLIENTES & CRM FUNNEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar Mix Monitor */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-900" />
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  2. Radar de Mix do Pipeline
                </h3>
                <p className="text-[11px] text-slate-500">
                  Monitoramento em tempo real do mix projetado vs metas do BP v3.5
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              03_Cenarios_Sensibilidade.csv
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span>P1 · Estocador (Piso SANCO): {currentP1}%</span>
                <span className={currentP1 > 50 ? 'text-rose-600 font-extrabold' : 'text-slate-500'}>
                  {currentP1 > 50 ? '⚠️ RISCO ADVERSO (>50%)' : 'Alvo BP: 20%'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${currentP1 > 50 ? 'bg-rose-600' : 'bg-blue-600'}`} style={{ width: `${currentP1}%` }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span>P2 · Franquias Fitness: {activeMix.p2}%</span>
                <span className="text-slate-500">Alvo BP: 30%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${activeMix.p2}%` }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span>P4 · B2B Academias / Redes: {activeMix.p4}%</span>
                <span className="text-slate-500">Alvo BP: 25%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${activeMix.p4}%` }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span>P5 · Premium / Kitting Especial: {currentP5}%</span>
                <span className="text-slate-500">Alvo BP: 25%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${currentP5}%` }}></div>
              </div>
            </div>

            <div className="pt-2 flex justify-between gap-2">
              <button
                onClick={() => updateActiveMix({ p1: 20, p2: 30, p4: 25, p5: 25 })}
                className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Forçar Preset Ideal (20% P1)
              </button>

              <button
                onClick={() => updateActiveMix({ p1: 55, p2: 20, p4: 15, p5: 10 })}
                className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Simular Risco P1 (55%)
              </button>
            </div>
          </div>
        </div>

        {/* CRM Pipeline Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-900" />
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  3. Oportunidades no Funil CRM (180d)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Contratos em prospecção ativa para preenchimento das 2.968 posições
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              4 Leads Ativos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2 px-2 text-left">Prospect</th>
                  <th className="py-2 px-2 text-center">Perfil</th>
                  <th className="py-2 px-2 text-right">Posições</th>
                  <th className="py-2 px-2 text-right">Receita/mês</th>
                  <th className="py-2 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pipelineLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-bold text-slate-900">{lead.name}</td>
                    <td className="py-2 px-2 text-center font-mono uppercase font-bold text-blue-900">{lead.profile}</td>
                    <td className="py-2 px-2 text-right font-mono">{lead.positions} pos</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">R$ {lead.monthlyRevenue.toLocaleString('pt-BR')}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lead.status.includes('Âncora')
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
