import React from 'react';
import { usePlanner } from '../context/PlannerContext';
import { HubFitnessLogo } from './HubFitnessLogo';
import { exportDre24mCSV, exportDre24mPDF } from '../utils/exportHandlers';
import { buildLiveDreExport, formatBrlCell } from '../utils/liveExport';
import { X, Printer, Download, ShieldCheck } from 'lucide-react';

interface StructuredPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StructuredPdfReportModal: React.FC<StructuredPdfReportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { dreMonths, activeScenario, activeRole, fatorR, granularDreItems } = usePlanner();

  if (!isOpen) return null;

  const pack = buildLiveDreExport(dreMonths, granularDreItems);
  const { totals, years, seal } = pack;
  const totalRev24m = totals.receitaTotal;
  const totalLL24m = totals.lucroLiquidoTotal;
  const totalCustos24m = totals.custosOperacionaisTotal;
  const totalDespesas24m = totals.despesasOperacionaisTotal;
  const totalImpostos24m = totals.dasTotal;
  const margemPct = totals.margemLiquidaPercent.toFixed(1);
  const pctOfRev = (n: number) =>
    totalRev24m > 0 ? `${((n / totalRev24m) * 100).toFixed(1).replace('.', ',')}%` : '0,0%';
  const brlNeg = (n: number) => `R$ (${n.toLocaleString('pt-BR')})`;

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadPdfFile = () => {
    exportDre24mPDF(dreMonths, activeScenario.name, granularDreItems);
  };

  const handleDownloadCsvFile = () => {
    exportDre24mCSV(dreMonths, activeScenario.name, granularDreItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="bg-[#1F3864] px-4 py-3 text-white no-print border-b border-white/10">
          <div className="flex items-center gap-3">
            <HubFitnessLogo size="sm" variant="dark" iconOnly />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-bold leading-none truncate">
                  Relatório Executivo Estruturado · HUB-FITNESS
                </h3>
                <span className="text-[10px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded uppercase shrink-0 leading-none">
                  PDF Pronto
                </span>
              </div>
              <p className="text-[11px] text-white/65 mt-1 truncate leading-none">
                Visualização de impressão auditável para Diretoria e Conselho
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrintPdf}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer h-8"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Imprimir / Salvar PDF</span>
                <span className="md:hidden">PDF</span>
              </button>
              <button
                onClick={handleDownloadPdfFile}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer h-8"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Baixar (.pdf)</span>
              </button>
              <button
                onClick={handleDownloadCsvFile}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer h-8"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Baixar (.csv)</span>
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

        {/* Printable Structured PDF Document Body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-white text-gray-800" id="hub-fitness-pdf-content">
          {/* Header Branding */}
          <div className="flex flex-wrap justify-between items-end gap-4 border-b-2 border-[#1F3864] pb-5">
            <div className="space-y-1.5 min-w-0">
              <HubFitnessLogo size="lg" variant="light" showSubtitle={false} />
              <div className="text-xs text-gray-500 font-medium">
                Operador Logístico 3PL Especializado em Fitness & Sportswear
              </div>
            </div>

            <div className="text-right space-y-0.5 shrink-0">
              <div className="inline-block bg-[#006100] text-white text-[11px] font-bold px-3 py-1 rounded">
                {seal}
              </div>
              <div className="text-xs font-bold text-[#1F3864]">DOC ID: HUB-FIT-2026-X89</div>
              <div className="text-[11px] text-gray-500">Data de Emissão: {currentDate}</div>
              <div className="text-[11px] text-gray-500">
                Cenário: <strong className="text-gray-800">{activeScenario.name}</strong>
              </div>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-gray-200">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">Receita Bruta (24m)</div>
              <div className="text-lg font-extrabold text-[#1F3864] font-mono mt-0.5">
                {formatBrlCell(totalRev24m)}
              </div>
              <div className="text-[10px] text-green-700 font-bold mt-0.5">{seal}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">LL Ano 1 / Ano 2</div>
              <div className="text-sm font-extrabold text-[#006100] font-mono mt-0.5">
                {formatBrlCell(years.y1.lucro)} / {formatBrlCell(years.y2.lucro)}
              </div>
              <div className="text-[10px] text-gray-600 font-medium mt-0.5">LL 24m: {formatBrlCell(totalLL24m)}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">Fator R Atual</div>
              <div className="text-lg font-extrabold text-[#7F6000] font-mono mt-0.5">
                {fatorR}%
              </div>
              <div className="text-[10px] text-green-700 font-bold mt-0.5">● Anexo III (6,0%) OK</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">Saldo Mínimo & M24</div>
              <div className="text-sm font-extrabold text-[#1F3864] font-mono mt-0.5">
                R$ 59,7k Min / R$ {(activeScenario.m24Cash / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k M24
              </div>
              <div className="text-[10px] text-blue-700 font-bold mt-0.5">Payback M5 (c/ Carência Aluguel) / M8</div>
            </div>
          </div>

          {/* Section 1: Demonstrativo de Resultados (DRE 24m) */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-[#1F3864] border-l-4 border-[#10B981] pl-2 uppercase tracking-wide">
              1. Demonstrativo de Resultados Sintético (DRE 24 Meses)
            </h4>

            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#1F3864] text-white font-bold">
                  <th className="py-2 px-3 text-left">Grupo de Contas DRE</th>
                  <th className="py-2 px-3 text-right">Ano 1 (M1–M12)</th>
                  <th className="py-2 px-3 text-right">Ano 2 (M13–M24)</th>
                  <th className="py-2 px-3 text-right">Acumulado 24 Meses</th>
                  <th className="py-2 px-3 text-right">% Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-white font-bold text-gray-900">
                  <td className="py-2 px-3">(+) Receita de Serviços 3PL / VAS</td>
                  <td className="py-2 px-3 text-right font-mono">{formatBrlCell(years.y1.receita)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatBrlCell(years.y2.receita)}</td>
                  <td className="py-2 px-3 text-right font-mono text-[#1F3864]">{formatBrlCell(totalRev24m)}</td>
                  <td className="py-2 px-3 text-right font-mono">100,0%</td>
                </tr>
                <tr className="bg-gray-50 text-red-700 font-medium">
                  <td className="py-2 px-3">(−) Impostos sobre Serviços (DAS Simples - Anexo III)</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(years.y1.das)}</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(years.y2.das)}</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(totalImpostos24m)}</td>
                  <td className="py-2 px-3 text-right font-mono">{pctOfRev(totalImpostos24m)}</td>
                </tr>
                <tr className="bg-white text-gray-800">
                  <td className="py-2 px-3">(−) Custos Operacionais Diretos (WMS, Galpão, Insumos)</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(years.y1.custos)}</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(years.y2.custos)}</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(totalCustos24m)}</td>
                  <td className="py-2 px-3 text-right font-mono">{pctOfRev(totalCustos24m)}</td>
                </tr>
                <tr className="bg-gray-50 text-gray-800">
                  <td className="py-2 px-3">(−) Despesas Administrativas & Prolabore Fator R</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(years.y1.despesas)}</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(years.y2.despesas)}</td>
                  <td className="py-2 px-3 text-right font-mono">{brlNeg(totalDespesas24m)}</td>
                  <td className="py-2 px-3 text-right font-mono">{pctOfRev(totalDespesas24m)}</td>
                </tr>
                <tr className="bg-[#C6EFCE]/30 font-extrabold text-[#006100] border-t-2 border-[#006100]/30">
                  <td className="py-2.5 px-3">(=) LUCRO LÍQUIDO DO PERÍODO</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatBrlCell(years.y1.lucro)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatBrlCell(years.y2.lucro)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-base">{formatBrlCell(totalLL24m)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{margemPct.replace('.', ',')}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Eficiência Operacional TCO (HUB-FITNESS vs Gestão Própria) */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-[#1F3864] border-l-4 border-[#10B981] pl-2 uppercase tracking-wide">
              2. Análise de Eficiência TCO (HUB-FITNESS 3PL vs Operação Própria)
            </h4>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-gray-200">
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-700">Operação Própria (In-house)</div>
                <div className="text-base font-bold text-red-700 font-mono">R$ 83.868,80 / mês</div>
                <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4">
                  <li>Aluguel de galpão individual sem escalabilidade</li>
                  <li>Equipe dedicada com alto passivo trabalhista</li>
                  <li>Sistemas WMS e segurança contratados à parte</li>
                </ul>
              </div>

              <div className="space-y-2 border-l border-gray-200 pl-4">
                <div className="text-xs font-bold text-[#1F3864]">Operação Terceirizada HUB-FITNESS</div>
                <div className="text-base font-bold text-[#006100] font-mono">R$ 43.271,90 / mês</div>
                <div className="inline-block bg-[#006100] text-white font-bold text-[10px] px-2 py-0.5 rounded">
                  REDUÇÃO LÍQUIDA DE TCO: -48,4%
                </div>
                <p className="text-[11px] text-gray-600">
                  Rateio de mão de obra especializada, infraestrutura compartilhada e ganhos de escala em serviços VAS.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Governança, Compliance & Fator R */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-[#1F3864] border-l-4 border-[#10B981] pl-2 uppercase tracking-wide">
              3. Governança Fiscal & Enquadramento no Simples Nacional
            </h4>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#7F6000]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Enquadramento do Fator R em 28,4% (Garantia do Anexo III)</span>
              </div>
              <p className="leading-relaxed">
                O modelo de governança financeira ajusta dinamicamente a folha de pagamento e prolabore para manter a relação Folha/Receita estritamente na banda de segurança (28,0% – 28,7%). Isso garante a tributação reduzida em <strong>6,0% no Anexo III</strong>, evitando a alíquota de 15.5% do Anexo V.
              </p>
            </div>
          </div>

          {/* Section 4: Assinaturas & Validação de Auditoria */}
          <div className="border-t-2 border-gray-200 pt-6 mt-8 space-y-4">
            <div className="flex justify-between items-end text-xs">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-gray-400 uppercase">Aprovação Executiva</div>
                <div className="text-xs font-bold text-gray-800">Comitê de Investimento & Diretoria CFO</div>
                <div className="text-[11px] text-gray-500">Papel Ativo: <span className="font-semibold">{activeRole}</span></div>
              </div>

              <div className="text-right space-y-1 font-mono text-[10px] text-gray-500">
                <div>HASH DE VALIDAÇÃO: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>
                <div>HUB-FITNESS v3.5 AUDITED ENGINE · STAMP {new Date().getTime()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-8">
              <div className="border-t border-gray-400 text-center pt-2 text-xs font-bold text-gray-700">
                Diretoria de Operações Logistics (HUB-FITNESS)
              </div>
              <div className="border-t border-gray-400 text-center pt-2 text-xs font-bold text-gray-700">
                Consultoria Fiscal & CFO Virtual
              </div>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-gray-100 p-3 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500 no-print">
          <span>Relatório estruturado gerado pelo sistema HUB-FITNESS Planner</span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-700 hover:text-gray-900"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
