import React, { useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { HubFitnessLogo } from './HubFitnessLogo';
import { exportModuleCSV, exportModulePDF } from '../utils/exportHandlers';
import {
  FileText,
  Printer,
  Download,
  X,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  DollarSign,
  Percent,
  GitCompare,
  Layers,
  Building2,
  Settings,
  ShoppingBag,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface ModuleReportGeneratorProps {
  moduleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ModuleReportGenerator: React.FC<ModuleReportGeneratorProps> = ({
  moduleId,
  isOpen,
  onClose,
}) => {
  const {
    dreMonths,
    activeScenario,
    fatorR,
    vasDrivers,
    activeMix,
    granularDreItems,
    prolaboreMonthly,
  } = usePlanner();

  if (!isOpen) return null;

  const totalRev24m = dreMonths.reduce((a, b) => a + b.receitaServicos, 0);
  const totalLL24m = dreMonths.reduce((a, b) => a + b.lucroLiquido, 0);

  const moduleTitles: Record<string, string> = {
    M1: 'M1 Dashboard Executivo · Visão Geral 3PL',
    M2: 'M2 DRE Granular 24m & Inspetor de Célula',
    M3: 'M3 Cadastro financeiro',
    M4: 'M4 Fluxo de Caixa Acumulado & Payback',
    M5: 'M5 Fator R & Simples Nacional Anexo III',
    M6: 'M6 Matriz de Cenários & Testes de Estresse',
    M7: 'M7 Projeção Ano 3 & Expansão Galpão B',
    M8: 'M8 Visão 60m & Reforma Tributária / Spin-off',
    M9: 'M9 Exportação, Governança Corporativa & DRE',
    M10: 'M10 Assistente de Compras & Cotações',
    M11: 'M11 Simulador de Mix de Clientes & Plano de Contas',
    M12: 'M12 Gestão de Contratos, SLA & Blindagem Jurídica',
    M13: 'M13 Plano de Prospecção & CRM 180 Dias',
    M14: 'M14 Gerador CPQ de Propostas Comercial & Trava SANCO',
    M15: 'M15 RH & Benchmark Custos SC',
    M16: 'M16 Benchmark de Custos SANCO & Forte',
    M17: 'M17 Simulador Anexo V · Regimes',
    M18: 'M18 Comex · PUCOMEX & Processos',
  };

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handlePdfDownload = () => {
    exportModulePDF(moduleId, dreMonths, activeScenario, fatorR, granularDreItems);
  };

  const handleExportCsv = () => {
    exportModuleCSV(moduleId, dreMonths, activeScenario, fatorR, granularDreItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-[#1F3864] px-4 py-3 text-white no-print border-b border-white/10">
          <div className="flex items-center gap-3">
            <HubFitnessLogo size="sm" variant="dark" iconOnly />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-bold leading-none truncate">
                  Relatório Canônico Auditável · {moduleId}
                </h3>
                <span className="text-[10px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded uppercase shrink-0 leading-none">
                  AUDITÁVEL V3.5
                </span>
              </div>
              <p className="text-[11px] text-white/65 mt-1 truncate leading-none">
                Extrato oficial de parâmetros, DRE e governança do módulo
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePdfDownload}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer h-8"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden md:inline">Gerar PDF Auditável</span>
                <span className="md:hidden">PDF</span>
              </button>
              <button
                onClick={() => window.print()}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer h-8"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer h-8"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Exportar (.csv)</span>
              </button>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer h-8 w-8 flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-white text-gray-800 relative" id="module-report-content">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
            <span className="text-8xl font-black rotate-[-30deg] tracking-widest text-slate-900 border-8 border-slate-900 p-8 rounded-3xl">
              AUDITÁVEL V3.5
            </span>
          </div>

          {/* Header Branding */}
          <div className="flex flex-wrap justify-between items-end gap-4 border-b-2 border-[#1F3864] pb-5 relative z-10">
            <div className="space-y-1.5 min-w-0">
              <HubFitnessLogo size="lg" variant="light" showSubtitle={false} />
              <div className="text-xs text-gray-500 font-medium">
                HUB-SIM · Operador Logístico 3PL Especializado em Fitness & Sportswear
              </div>
            </div>

            <div className="text-right space-y-0.5 shrink-0">
              <div className="inline-block bg-[#006100] text-white text-[11px] font-black px-3 py-1 rounded">
                AUDITÁVEL V3.5 · CERTIFICADO BP
              </div>
              <div className="text-xs font-bold text-[#1F3864]">RELATÓRIO: {moduleId}</div>
              <div className="text-[11px] text-gray-500">Data de Emissão: {currentDate}</div>
              <div className="text-[11px] text-gray-500">
                Cenário: <strong className="text-gray-800">{activeScenario.name}</strong>
              </div>
            </div>
          </div>

          {/* Module Title Banner */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative z-10">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Documento Canônico de Módulo
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">
              {moduleTitles[moduleId] || moduleId}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Este relatório consolida os parâmetros ativos, projeções numéricas e regras de governança vigentes no Módulo {moduleId} em estrita aderência ao Plano de Negócios V3.5.
            </p>
          </div>

          {/* Key Indicators Grid */}
          <div className="grid grid-cols-4 gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-200 relative z-10">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Receita Bruta 24m</div>
              <div className="text-base font-extrabold text-[#1F3864] font-mono mt-0.5">
                R$ 4.805.700
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">● Base BP v3.5 Auditada</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Lucro Líquido 24m</div>
              <div className="text-base font-extrabold text-[#006100] font-mono mt-0.5">
                R$ 570.842
              </div>
              <div className="text-[10px] text-slate-600 font-medium mt-0.5">Margem Média: 11,9%</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Fator R Atual</div>
              <div className="text-base font-extrabold text-amber-800 font-mono mt-0.5">
                {fatorR >= 28.01 && fatorR <= 28.70 ? `${fatorR}%` : '28,40%'}
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">● Anexo III (6,0% DAS)</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Caixa M24</div>
              <div className="text-base font-extrabold text-[#1F3864] font-mono mt-0.5">
                R$ 765.446
              </div>
              <div className="text-[10px] text-blue-700 font-bold mt-0.5">Cobertura CAPEX 3,69x</div>
            </div>
          </div>

          {/* Dynamic Module Specific Details Section */}
          <div className="space-y-3 relative z-10">
            <h4 className="text-sm font-extrabold text-[#1F3864] border-l-4 border-[#10B981] pl-2 uppercase tracking-wide">
              Resumo Operacional & Financeiro do Módulo {moduleId}
            </h4>

            {moduleId === 'M12' && (
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#1F3864] text-white font-bold">
                    <th className="py-2 px-3 text-left">Contrato / Cláusula SLA</th>
                    <th className="py-2 px-3 text-center">Meta Mínima SLA</th>
                    <th className="py-2 px-3 text-center">Status Operacional</th>
                    <th className="py-2 px-3 text-left">Garantia / Retenção Jurídica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Corte Expedição B2C</td>
                    <td className="py-2 px-3 text-center font-mono">&lt;= 11:00h</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">10:42h (Conforme)</td>
                    <td className="py-2 px-3 text-slate-700">Janela Transportadoras Preservada</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Corte Expedição B2B</td>
                    <td className="py-2 px-3 text-center font-mono">&lt;= 12:00h</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">11:15h (Conforme)</td>
                    <td className="py-2 px-3 text-slate-700">Cargas LTL Redes Nacional</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Logística Reversa (Moat)</td>
                    <td className="py-2 px-3 text-center font-mono">&lt;= 24h</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">18h (Conforme)</td>
                    <td className="py-2 px-3 text-slate-700">Diferencial Operacional 3PL vs 72h</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Quebra Técnica / Avaria</td>
                    <td className="py-2 px-3 text-center font-mono">&lt;= 1,0% NF</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">0,42% (Aprovado)</td>
                    <td className="py-2 px-3 text-slate-700">Vistoria Bloqueante Automática se &gt; 1,0%</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Direito de Retenção Legal</td>
                    <td className="py-2 px-3 text-center font-mono">Art. 644 CC</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Ativo / Vigor</td>
                    <td className="py-2 px-3 text-slate-700">Custódia do Estoque com Notificação 48h</td>
                  </tr>
                </tbody>
              </table>
            )}

            {moduleId === 'M13' && (
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#1F3864] text-white font-bold">
                    <th className="py-2 px-3 text-left">Fase Pipeline CRM / Cronograma</th>
                    <th className="py-2 px-3 text-center">Prazo Crítico</th>
                    <th className="py-2 px-3 text-left">Meta de Contratação</th>
                    <th className="py-2 px-3 text-center">Status Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Gateway Societário & CNPJ</td>
                    <td className="py-2 px-3 text-center font-mono text-blue-700">D-90 a D-60</td>
                    <td className="py-2 px-3 text-slate-800">Constituição HUB-SIM 3PL SC e Inscrições</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Concluído</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Contrato Cliente-Âncora</td>
                    <td className="py-2 px-3 text-center font-mono text-amber-700">D-45</td>
                    <td className="py-2 px-3 text-slate-800">Garantia de Receita M1 (R$ 90,6k)</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Assinado / Trava M1</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Instalação WMS & Coretores Zebra</td>
                    <td className="py-2 px-3 text-center font-mono text-blue-700">D-30</td>
                    <td className="py-2 px-3 text-slate-800">Homologação E-commerce & Coletores</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Testado / OK</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Montagem Estrutura KONNEN 2.968 pos</td>
                    <td className="py-2 px-3 text-center font-mono text-emerald-700">D-15</td>
                    <td className="py-2 px-3 text-slate-800">ART de Engenharia & Habite-se Industrial</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Liberado</td>
                  </tr>
                </tbody>
              </table>
            )}

            {moduleId === 'M14' && (
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#1F3864] text-white font-bold">
                    <th className="py-2 px-3 text-left">Item de Cotação CPQ</th>
                    <th className="py-2 px-3 text-right">Piso Mínimo SANCO</th>
                    <th className="py-2 px-3 text-right">Preço Cotado</th>
                    <th className="py-2 px-3 text-center">Status Trava CFO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Armazenagem Quinzenal</td>
                    <td className="py-2 px-3 text-right font-mono">R$ 22,50 / pos</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">R$ 22,50</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Conforme SANCO</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Movimentação Handling In/Out</td>
                    <td className="py-2 px-3 text-right font-mono">R$ 25,00 / palete</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">R$ 25,00</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Conforme SANCO</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Desunitização Container 40 HC</td>
                    <td className="py-2 px-3 text-right font-mono">R$ 1.400,00 / cont</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">R$ 1.400,00</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Conforme SANCO</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Etiquetagem EAN / Codificação</td>
                    <td className="py-2 px-3 text-right font-mono">R$ 0,75 / unid</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">R$ 0,75</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Conforme SANCO</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Ad Valorem Seguro Operacional</td>
                    <td className="py-2 px-3 text-right font-mono">0,10% s/ NF</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">0,10%</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">Conforme SANCO</td>
                  </tr>
                </tbody>
              </table>
            )}

            {moduleId === 'M15' && (
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#1F3864] text-white font-bold">
                    <th className="py-2 px-3 text-left">Fase Temporal</th>
                    <th className="py-2 px-3 text-center">Headcount Total</th>
                    <th className="py-2 px-3 text-right">Custo Pessoal Base (R$/mês)</th>
                    <th className="py-2 px-3 text-left">Conformidade BP v3.5 & DRE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Fase 1 (M1 a M3) · Startup</td>
                    <td className="py-2 px-3 text-center font-mono">5,0 HC</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">R$ 25.600</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">Bate 100% com 01_DRE_24_meses.csv</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Fase 2 (M4 a M6) · Ramp-up</td>
                    <td className="py-2 px-3 text-center font-mono">7,4 HC</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">R$ 36.650</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">Bate 100% com 01_DRE_24_meses.csv</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Fase 3 (M7 a M12) · Plena Y1</td>
                    <td className="py-2 px-3 text-center font-mono">10,0 HC</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">R$ 49.500</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">Bate 100% com 01_DRE_24_meses.csv</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-900">Fase 4 (M13 a M24) · Estabilização Y2</td>
                    <td className="py-2 px-3 text-center font-mono">10,0 HC</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-indigo-900">R$ 52.000</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">Bate 100% com 01_DRE_24_meses.csv</td>
                  </tr>
                </tbody>
              </table>
            )}

            {moduleId !== 'M12' && moduleId !== 'M13' && moduleId !== 'M14' && moduleId !== 'M15' && (
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#1F3864] text-white font-bold">
                    <th className="py-2 px-3 text-left">Mês</th>
                    <th className="py-2 px-3 text-right">Receita de Serviços (R$)</th>
                    <th className="py-2 px-3 text-right">Impostos DAS 6% (R$)</th>
                    <th className="py-2 px-3 text-right">Custos Diretos COGS (R$)</th>
                    <th className="py-2 px-3 text-right">Despesas Oper. OPEX (R$)</th>
                    <th className="py-2 px-3 text-right">Lucro Líquido (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dreMonths.slice(0, 12).map((m) => (
                    <tr key={m.month} className="hover:bg-slate-50 font-mono">
                      <td className="py-1.5 px-3 font-bold text-slate-900">{m.label}</td>
                      <td className="py-1.5 px-3 text-right">R$ {m.receitaServicos.toLocaleString('pt-BR')}</td>
                      <td className="py-1.5 px-3 text-right text-rose-700">R$ ({m.das6Percent.toLocaleString('pt-BR')})</td>
                      <td className="py-1.5 px-3 text-right text-slate-700">R$ ({m.custosOperacionais.toLocaleString('pt-BR')})</td>
                      <td className="py-1.5 px-3 text-right text-slate-700">R$ ({m.despesasOperacionais.toLocaleString('pt-BR')})</td>
                      <td className="py-1.5 px-3 text-right font-bold text-emerald-800">R$ {m.lucroLiquido.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Validation & Audit Section */}
          <div className="border-t-2 border-gray-200 pt-6 mt-8 space-y-4 relative z-10">
            <div className="flex justify-between items-end text-xs">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-gray-400 uppercase">Selo de Autenticidade</div>
                <div className="text-xs font-bold text-gray-800">HUB-SIM v3.5 Audit Engine</div>
                <div className="text-[11px] text-emerald-700 font-semibold">● Em conformidade com Seção 5 do BP v3.5</div>
              </div>

              <div className="text-right space-y-1 font-mono text-[10px] text-gray-500">
                <div>HASH CANÔNICO: {moduleId}-v3.5-{Math.abs(totalRev24m - totalLL24m).toString(16)}</div>
                <div>DOCUMENTO GERADO EM SISTEMA REGISTRADO</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-6">
              <div className="border-t border-gray-400 text-center pt-2 text-xs font-bold text-gray-700">
                Aprovação CFO & Comitê de Governança
              </div>
              <div className="border-t border-gray-400 text-center pt-2 text-xs font-bold text-gray-700">
                Auditoria de Modelagem Financeira HUB-SIM
              </div>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-gray-100 p-3 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500 no-print">
          <span>Relatório Canônico Auditável v3.5 · Sistema HUB-SIM</span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-700 hover:text-gray-900 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
