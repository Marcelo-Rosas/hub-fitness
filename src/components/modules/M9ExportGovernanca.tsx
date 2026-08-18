import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { saveFileToGoogleDrive } from '../../utils/googleDrive';
import { exportModuleCSV, exportModulePDF } from '../../utils/exportHandlers';
import { captureScreenToPng } from '../../utils/screenCapture';
import {
  FileText,
  FileSpreadsheet,
  CloudUpload,
  Link,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Unlock,
  History,
  AlertOctagon,
  Download,
  Sparkles,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { ContractChip } from '../ContractChip';
import { StructuredPdfReportModal } from '../StructuredPdfReportModal';
import {
  buildConsistencyMatrix,
  buildPreErpChecklist,
  formatDasPct,
  formatFatorRBand,
  m7RevenueCeiling,
  plPhaseBands,
} from '../../core/governanceMatrix';
import { plAdditionalForMonth } from '../../core/engine';
import { deriveCashMilestones } from '../../core/cashMilestones';
import { parseOfficialCSVs } from '../../data/officialData';

export const M9ExportGovernanca: React.FC = () => {
  const {
    governanceChecks,
    auditLogs,
    activeScenario,
    dreMonths,
    fatorR,
    pitchMode,
    setPitchMode,
    addAuditLog,
    vasDrivers,
    activeMix,
    hubParams,
    granularDreItems,
  } = usePlanner();

  const [driveExportStatus, setDriveExportStatus] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [showPitchUnlockModal, setShowPitchUnlockModal] = useState<boolean>(false);

  const totalRev24m = dreMonths.reduce((a, b) => a + b.receitaServicos, 0);
  const totalLL24m = dreMonths.reduce((a, b) => a + b.lucroLiquido, 0);
  const plBands = plPhaseBands(hubParams);
  const plM7 = plAdditionalForMonth(hubParams, 7);
  const plM12 = plAdditionalForMonth(hubParams, 12);
  const band = formatFatorRBand(hubParams);
  const dasLabel = formatDasPct(hubParams);
  const cap = hubParams.capacity.totalPositions;
  const m7Ceiling = m7RevenueCeiling(hubParams);

  const cashMilestones = useMemo(() => {
    const { cashflowSeries } = parseOfficialCSVs();
    return deriveCashMilestones(
      cashflowSeries.map((c) => ({
        month: c.month,
        monthNum: c.monthNum,
        saldo: c.saldoAcumuladoCarenciaAluguel,
        fluxo: c.fluxoLiquidoCarenciaAluguel,
      })),
      { rentOnMonthNum: hubParams.rent.carenciaAluguelMeses + 1 },
    );
  }, [hubParams.rent.carenciaAluguelMeses]);

  const consistencyInput = useMemo(
    () => ({
      hubParams,
      dreMonths,
      activeScenario,
      fatorR,
      vasDrivers,
      granularDreItems,
      activeMix,
    }),
    [hubParams, dreMonths, activeScenario, fatorR, vasDrivers, granularDreItems, activeMix],
  );

  const consistencyMatrix = useMemo(
    () => buildConsistencyMatrix(consistencyInput),
    [consistencyInput],
  );

  const preErpChecklist = useMemo(
    () => buildPreErpChecklist(consistencyInput),
    [consistencyInput],
  );

  const handleDriveExport = async () => {
    setDriveExportStatus('Exportando relatório para o Google Drive...');
    const reportText = `HUB-FITNESS · 3PL LOGISTICS PLANNER - RELATÓRIO EXECUTIVO AUDITADO v3.5
========================================================================
Cenário Ativo: ${activeScenario.name}
Data do Relatório: ${new Date().toLocaleString('pt-BR')}

INDICADORES CANÔNICOS BP v3.5:
------------------------------------------------------------------------
- Payback CAPEX: ${cashMilestones.payback?.month ?? '—'} (carência aluguel ${hubParams.rent.carenciaAluguelMeses}m)
- Vale: ${cashMilestones.valley.month} (${cashMilestones.valley.saldo.toLocaleString('pt-BR')})
- Receita Bruta Acumulada 24m: R$ ${totalRev24m.toLocaleString('pt-BR')}
- Lucro Líquido Acumulado 24m: R$ ${totalLL24m.toLocaleString('pt-BR')}
- Fator R Atual: ${fatorR}% (Simples Nacional Anexo III - Alíquota ${dasLabel})
- Regra Fator R: Numerador = CLT (5.2.01.01) + PL Regular (5.2.01.02) + PL Adicional (5.2.01.03) [MO Terceirizada EXCLUÍDA]
- Banda alvo: ${band}
- Saldo M24 Final: R$ ${activeScenario.m24Cash.toLocaleString('pt-BR')}
- CAPEX do Projeto: R$ ${hubParams.capex.total.toLocaleString('pt-BR')}
- Capacidade: ${cap.toLocaleString('pt-BR')} pos · Teto M7 R$ ${m7Ceiling.toLocaleString('pt-BR')}

NOTA OBRIGATÓRIA DE CONCILIAÇÃO DRE X FLUXO DE CAIXA:
------------------------------------------------------------------------
A diferença mensal de R$ ${plM7.toLocaleString('pt-BR')}/mês (fase PL adicional) e R$ ${plM12.toLocaleString('pt-BR')} (M12+) refere-se ao Pró-labore Adicional de ajuste do Fator R, contabilizado como despesa de pessoal na DRE (Numerador) para garantir a alíquota reduzida do Anexo III (${dasLabel}), sem desembolso adicional de caixa operacional além da distribuição de lucros planejada.

MATRIZ DE CONSISTÊNCIA DA AUDITORIA:
------------------------------------------------------------------------
Status Global: ${consistencyMatrix.hasCritical ? '⚠️ CONDICIONALMENTE APROVADO' : '✅ APROVADO DEFINITIVO (BP v3.5)'}
${consistencyMatrix.rows.map((r) => `- [${r.status === 'passed' ? 'OK' : 'AJUSTAR'}] ${r.dimension}: ${r.systemValue} (Ref: ${r.reference})`).join('\n')}

CHECKLIST DE GOVERNANÇA:
${governanceChecks.map((g) => `- [${g.status === 'passed' ? 'X' : ' '}] ${g.label}: ${g.detail}`).join('\n')}

PRÉ-ERP:
${preErpChecklist.map((c) => `- [${c.passed ? 'X' : ' '}] ${c.label}: ${c.detail}`).join('\n')}

TRILHA DE AUDITORIA RECENTE:
${auditLogs.slice(0, 5).map((l) => `- ${l.timestamp} | ${l.user} | ${l.driver}: ${l.before} -> ${l.after}`).join('\n')}
`;

    const res = await saveFileToGoogleDrive({
      filename: `HUB-FITNESS_Relatorio_Executivo_${activeScenario.name.replace(/\s+/g, '_')}_v3.5.txt`,
      mimeType: 'text/plain',
      content: reportText,
    });

    if (res.success) {
      setDriveExportStatus(`✅ Exportado para o Google Drive com sucesso! ID: ${res.fileId}`);
    } else {
      setDriveExportStatus(`⚠️ ${res.error}`);
    }
  };

  const handleTestPitchModeLock = () => {
    if (!pitchMode) {
      setPitchMode(true);
      addAuditLog('Pitch Mode', 'Inativo', 'Ativado com Trava de Governança');
    } else {
      setShowPitchUnlockModal(true);
    }
  };

  const isDeprecatedLog = (text: string) => {
    return /425|789|804|21,7|387|6\.007|950/i.test(text);
  };

  return (
    <div className="space-y-6">
      {/* Pitch Mode Lock Confirmation Modal */}
      {showPitchUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-amber-500/40 text-white p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <Lock className="w-6 h-6 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Desbloquear Pitch Mode</h3>
                <p className="text-xs text-slate-400">Trava de Governança Corporativa Active</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O Pitch Mode congela todos os drivers e premissas contra alterações durante apresentações ao Board/Investidores. Deseja desativar esta trava de segurança?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPitchUnlockModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancelar (Manter Bloqueado)
              </button>
              <button
                onClick={() => {
                  setPitchMode(false);
                  setShowPitchUnlockModal(false);
                  addAuditLog('Pitch Mode', 'Ativo', 'Desativado via confirmação de segurança');
                }}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold"
              >
                Desbloquear Governança
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M9"
        title="Exportação, Governança Corporativa & Pitch Mode"
        subtitle="Matriz de consistência de auditoria em tempo real, travamento de premissas para apresentações de pitch e integração com Google Drive."
        kpis={[
          {
            label: 'Status da Auditoria BP v3.5',
            value: consistencyMatrix.hasCritical ? 'CONDICIONAL' : 'APROVADO DEFINITIVO',
            subtext: consistencyMatrix.hasCritical ? '⚠️ Exige atenção na matriz' : '✓ 100% em conformidade',
            badge: 'AUDITORIA',
            highlightColor: consistencyMatrix.hasCritical ? 'rose' : 'emerald',
          },
          {
            label: 'Pitch Mode (Board)',
            value: pitchMode ? 'TRAVADO (ATIVO)' : 'LIVRE (EDIÇÃO)',
            subtext: pitchMode ? 'Premissas congeladas' : 'Edições liberadas',
            badge: 'GOVERNAÇA',
            highlightColor: pitchMode ? 'amber' : 'slate',
          },
          {
            label: 'Trilha de Auditoria',
            value: `${auditLogs.length} Registros`,
            subtext: 'Histórico de edições e parâmetros',
            badge: 'LOGS',
            highlightColor: 'indigo',
          },
          {
            label: 'Conformidade Fator R',
            value: `${fatorR}%`,
            subtext: 'Anexo III Simples Nacional (6,0%)',
            badge: 'FISCAL',
            highlightColor: 'emerald',
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => captureScreenToPng('main-content', 'hub-sim-painel-governanca.png')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar PNG desta Tela</span>
            </button>
            <button
              onClick={handleDriveExport}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Salvar no Drive</span>
            </button>
            <button
              onClick={handleTestPitchModeLock}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                pitchMode ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              {pitchMode ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{pitchMode ? 'Desbloquear Pitch' : 'Ativar Pitch Mode'}</span>
            </button>
          </div>
        }
      />

      {driveExportStatus && (
        <div className="bg-blue-900 text-white p-3 rounded-lg text-xs font-mono flex justify-between items-center">
          <span>{driveExportStatus}</span>
          <button onClick={() => setDriveExportStatus(null)} className="text-blue-200 hover:text-white">✕</button>
        </div>
      )}

      {/* NAVIGATION TABS FOR GOVERNANCE & AUDIT REPORT */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold uppercase border border-amber-500/30">
                Relatório de Auditoria Unificada
              </span>
              <span className="text-xs text-slate-400 font-mono">Parecer Executivo Definitivo BP v3.5</span>
            </div>
            <h2 className="text-lg font-black text-white mt-1 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-amber-400" />
              <span>Auditoria Unificada do Ecossistema 3PL Fitness Hub Itajaí</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 border rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                consistencyMatrix.hasCritical
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
              }`}
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${consistencyMatrix.hasCritical ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span>
                Status: {consistencyMatrix.hasCritical ? '⚠️ CONDICIONALMENTE APROVADO' : '✅ APROVADO DEFINITIVO (BP v3.5)'}
              </span>
            </span>
          </div>
        </div>

        {/* 1. MATRIZ DE CONSISTÊNCIA CRUZADA DInÂMICA (A "PROVA REAL") */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>1. Matriz de Consistência Cruzada Dinâmica (A "Prova Real")</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">Validação em Tempo Real com Modelo Vivo</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-900 text-slate-300 font-bold text-[10px] uppercase border-b border-slate-800">
                  <th className="py-2.5 px-3">Dimensão</th>
                  <th className="py-2.5 px-3">Referência BP v3.5</th>
                  <th className="py-2.5 px-3">Valor no Sistema Proposto</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Ação Corretiva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200 text-[11px]">
                {consistencyMatrix.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 font-bold text-amber-300">{row.dimension}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">{row.reference}</td>
                    <td className={`py-2.5 px-3 font-mono ${row.status === 'passed' ? 'text-emerald-300' : row.status === 'warning' ? 'text-amber-300' : 'text-rose-400'}`}>
                      {row.systemValue}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase ${
                          row.status === 'passed'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : row.status === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {row.status === 'passed' ? '✅ OK' : row.status === 'warning' ? '🟡 ATENÇÃO' : '🔴 CRÍTICO'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. DIAGNÓSTICO POR PILAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Pilar A: Perfil de Clientes */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>A. Perfil de Clientes & Mix</span>
              <span className="text-[10px] font-mono text-emerald-400">STATUS: AUDITADO</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Matriz de enquadramento técnico (P1/P2/P4/P5) robusta e aderente. Vetos matemáticos confirmados: Monoclientes P1 (BE &gt; 91%), P4 e P5 permanecem bloqueados por estrita política de governança.
            </p>
          </div>

          {/* Pilar B: Receita & VAS */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>B. Receita & VAS (Dashboard WEB)</span>
              <span className="text-[10px] font-mono text-emerald-400">STATUS: AUDITADO & TETO ATIVO</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Teto físico de {cap.toLocaleString('pt-BR')} posições gera R$ {m7Ceiling.toLocaleString('pt-BR')}/mês na base M7 (params). Serviços Core (Handling / Descarga / Reversa) reconfirmados no catálogo VAS.
            </p>
          </div>

          {/* Pilar C: Plano de Contas */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>C. Plano de Contas & DRE Auditável</span>
              <span className="text-[10px] font-mono text-emerald-400">STATUS: 100% ADERENTE</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Inclusão das contas analíticas 4.1.04.01, 5.1.03.03 e 5.1.04.01 concluída. Mão de Obra Terceirizada acima do Lucro Bruto e conciliação de R$ {plM7.toLocaleString('pt-BR')}/mês do Pró-labore Adicional (hubParams.fiscal) mapeados.
            </p>
          </div>

          {/* Pilar D: Governança Financeira */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>D. Governança Financeira & Fator R</span>
              <span className="text-[10px] font-mono text-emerald-400">STATUS: CONFORME</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Mecânica de ajuste via Pró-labore discricionário mantém o Fator R na banda segura de {band} (Simples Nacional Anexo III, DAS {dasLabel}). Payback {cashMilestones.payback?.month ?? '—'} (série com carência) · Vale {cashMilestones.valley.month} · caixa M24 derivado do engine.
            </p>
          </div>
        </div>

        {/* 3. NOTA OBRIGATÓRIA DE CONCILIAÇÃO DRE X FLUXO DE CAIXA */}
        <div className="p-4 bg-slate-950 rounded-xl border border-blue-500/30 text-xs text-slate-300 space-y-2">
          <div className="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>3. Nota Obrigatória de Conciliação DRE x Fluxo de Caixa (Auditoria Externa)</span>
          </div>
          <p className="leading-relaxed">
            💡 <strong>Diferença de Conciliação DRE x FC:</strong> A diferença mensal de{' '}
            <strong>
              R$ {plM7.toLocaleString('pt-BR')}/mês (fase a partir de M{plBands[0]?.fromMonth ?? 4})
            </strong>{' '}
            e <strong>R$ {plM12.toLocaleString('pt-BR')} (M{plBands[1]?.fromMonth ?? 12}+)</strong> refere-se ao{' '}
            <strong>Pró-labore Adicional</strong> de ajuste do Fator R, contabilizado como despesa de pessoal na DRE
            (Numerador) para garantir a alíquota reduzida do Simples Nacional Anexo III ({dasLabel}), sem desembolso
            adicional de caixa operacional além da distribuição de lucros planejada.
          </p>
        </div>

        {/* 4. CHECKLIST DE IMPLEMENTAÇÃO PRÉ-ERP */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>4. Checklist de Implementação Pré-ERP (Passos de Validação Final)</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">HUB-SIM ERP Parametrization</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-200">
            {preErpChecklist.map((item) => (
              <div
                key={item.id}
                className={`p-2.5 bg-slate-900 rounded-lg border flex items-center gap-2 ${
                  item.passed ? 'border-slate-800' : 'border-amber-500/40'
                }`}
              >
                <span className={`font-bold ${item.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {item.passed ? '✓' : '!'}
                </span>
                <span>
                  <strong>{item.label}:</strong> {item.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. PARECER FINAL DO CONSELHO */}
        <div className="p-4 bg-emerald-950/40 rounded-xl border border-emerald-500/40 text-emerald-200 text-xs space-y-1">
          <div className="font-bold text-white uppercase flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>5. Parecer Final do Conselho Executivo BP v3.5</span>
          </div>
          <p className="leading-relaxed text-emerald-100">
            O ecossistema do BP v3.5 é <strong>viável, sustentável e defensável</strong>. Os números oficiais para pitch, auditoria e governança são exclusivamente os da <strong>tabela DRE v3.5</strong> e <strong>Fluxo de Caixa v3.1</strong>. Esta auditoria unificada substitui pareceres fragmentados e garante o fechamento contábil e tributário antes do envio ao ERP.
          </p>
        </div>
      </div>

      {/* Export Actions Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setIsPdfModalOpen(true)}
          className="p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 shadow-xs text-left transition-all group cursor-pointer"
        >
          <Printer className="w-6 h-6 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xs font-bold text-emerald-950">Baixar Relatório PDF</div>
          <div className="text-[11px] text-emerald-800 mt-0.5">Documento estruturado HUB-FITNESS</div>
        </button>

        <button
          onClick={() => alert('Download do arquivo XLSX simulado com sucesso!')}
          className="p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs text-left transition-all group"
        >
          <FileSpreadsheet className="w-6 h-6 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xs font-bold text-slate-900">Exportar Planilha XLSX</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Modelo financeiro completo em Excel</div>
        </button>

        <button
          onClick={handleDriveExport}
          className="p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs text-left transition-all group"
        >
          <CloudUpload className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xs font-bold text-slate-900">Salvar no Google Drive</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Integração Google Workspace OAuth</div>
        </button>

        <button
          onClick={handleTestPitchModeLock}
          className={`p-4 rounded-xl border shadow-xs text-left transition-all group ${
            pitchMode ? 'bg-amber-500/20 border-amber-500/50 text-amber-900' : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <Lock className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
          <div className="text-xs font-bold text-slate-900">Pitch Mode {pitchMode ? '(ATIVO)' : '(Testar Trava)'}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {pitchMode ? 'Governança Ativa - Clique p/ Desbloquear' : 'Bloqueio duro contra edições não autorizadas'}
          </div>
        </button>
      </div>

      {/* Governance Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3 border-slate-100">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Checklist de Governança & Trava de Valores Deprecados</h3>
            <p className="text-xs text-slate-500">Garante conformidade com o manifesto de auditoria v3.5</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {governanceChecks.map((check) => (
            <div key={check.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
              {check.status === 'passed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>{check.label}</span>
                  {(check.id === 'gov-5' || check.id === 'gov-6') && (
                    <ContractChip id="D_TRAILING12" />
                  )}
                  {check.isLockedRule && (
                    <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[9px] font-bold rounded">
                      Regra Bloqueada
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                      check.status === 'passed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Trail Log Table with Deprecated Tag Detection */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Trilha de Auditoria (Audit Log em Tempo Real)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Registro Histórico Imutável</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4 font-sans">Timestamp</th>
                <th className="py-2.5 px-4 font-sans">Papel / Usuário</th>
                <th className="py-2.5 px-4 font-sans">Driver Alterado</th>
                <th className="py-2.5 px-4 text-right">Valor Anterior</th>
                <th className="py-2.5 px-4 text-right text-emerald-800">Novo Valor</th>
                <th className="py-2.5 px-4 text-center font-sans">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditLogs.map((log) => {
                const deprecated = isDeprecatedLog(log.driver + log.before + log.after);
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-500">{log.timestamp}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900">{log.user}</td>
                    <td className="py-2.5 px-4 font-sans text-blue-900 font-medium">{log.driver}</td>
                    <td className="py-2.5 px-4 text-right text-slate-500">{log.before}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{log.after}</td>
                    <td className="py-2.5 px-4 text-center">
                      {deprecated ? (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[9px] font-bold uppercase">
                          [DEPRECIADO]
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[9px] font-bold uppercase">
                          AUDITADO
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PREVIEW OF PDF ONE-PAGER WITH WATERMARK */}
      <div className="bg-slate-200 p-6 rounded-xl border border-slate-300 space-y-3">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
          <span>Prévia do Relatório One-Pager (2 Páginas)</span>
          <span className="text-emerald-800 font-mono">Watermark: "auditável v3.5"</span>
        </div>

        {/* Mock Printable Page */}
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto relative overflow-hidden border border-slate-300 font-sans">
          {/* Watermark Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-10">
            <span className="text-6xl font-black text-slate-900 transform -rotate-45 font-mono">
              AUDITÁVEL V3.5
            </span>
          </div>

          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-lg font-black text-slate-900">HUB-SIM · 3PL FITNESS PLANNER</h2>
              <p className="text-xs text-slate-500 font-mono">Relatório Executivo de Projeção Financeira & Tributária</p>
            </div>
            <div className="text-right text-xs font-mono">
              <div className="font-bold text-slate-900">Cenário: {activeScenario.name}</div>
              <div className="text-slate-500">Data: {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-500">Receita 24m</div>
              <div className="text-sm font-bold text-slate-900">R$ {(totalRev24m / 1000).toFixed(0)}k</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-500">Lucro Líquido 24m</div>
              <div className="text-sm font-bold text-emerald-700">R$ {(totalLL24m / 1000).toFixed(1)}k</div>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-[10px] text-slate-500">Fator R Atual</div>
              <div className="text-sm font-bold text-blue-900">{fatorR}%</div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed italic">
            "Este documento foi gerado pelo HUB-FITNESS 3PL Logistics Planner sob os critérios estritos de governança da biblioteca de drivers v3.5, validado para enquadramento no Simples Nacional Anexo III."
          </p>
        </div>
      </div>

      {/* Structured PDF Report Modal */}
      <StructuredPdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
};
