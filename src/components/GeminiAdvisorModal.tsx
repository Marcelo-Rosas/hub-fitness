import React, { useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { buildAdvisorContext } from '../core/advisor/context';
import { Sparkles, X, Bot, Send, RefreshCw, Check, Lightbulb, ArrowRight } from 'lucide-react';

interface GeminiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPrompt?: string;
}

export const GeminiAdvisorModal: React.FC<GeminiAdvisorModalProps> = ({
  isOpen,
  onClose,
  defaultPrompt,
}) => {
  const {
    activeModule,
    activeScenario,
    dreMonths,
    fatorR,
    hubParams,
    granularDreItems,
    vasDrivers,
  } = usePlanner();
  const [prompt, setPrompt] = useState(defaultPrompt || '');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const moduleNames: Record<string, string> = {
    M1: 'Dashboard Executivo 3PL',
    M2: 'DRE 24m & Inspetor de Célula',
    M3: 'Cadastro financeiro',
    M4: 'Fluxo de Caixa & Payback',
    M5: 'Fator R & Simples Nacional',
    M6: 'Matriz de Cenários',
    M7: 'Ano 3 & Expansão Galpão B',
    M8: 'Visão 60m & Reforma Tributária / Spin-off',
    M9: 'Exportação, Governança & PDF',
    M16: 'Benchmark de Custos SANCO & Forte',
    M17: 'Simulador Anexo V · Regimes de Capacidade',
    M18: 'Comex · PUCOMEX & Processos DUIMP',
  };

  const handleAnalyze = async (customText?: string) => {
    const textToQuery =
      customText ||
      prompt ||
      `Analise estrategicamente o módulo ${activeModule} (${moduleNames[activeModule]}) e sugira pontos de otimização de custo, risco fiscal e ROI.`;
    setLoading(true);
    setAnalysis(null);

    const contextData = buildAdvisorContext({
      module: `${activeModule} - ${moduleNames[activeModule] ?? activeModule}`,
      scenarioName: activeScenario.name,
      prompt: textToQuery,
      params: hubParams,
      activeScenario,
      dreMonths,
      granularDreItems,
      vasDrivers,
      fatorR,
      occupancyRate: activeScenario.occupancyRate,
    });

    try {
      const response = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: `${activeModule} - ${moduleNames[activeModule] ?? activeModule}`,
          scenarioName: activeScenario.name,
          prompt: textToQuery,
          contextData,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis(`Erro ao conectar com assistente Gemini: ${data.error}`);
      }
    } catch (err: any) {
      setAnalysis(`Falha na comunicação com o servidor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (analysis) {
      navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const storageFloor = hubParams.pricing.floors.storage;

  const quickPrompts = [
    'Análise de Cenário Instantâneo · Módulo Atual',
    `Conferir aderência ao benchmark SANCO (Armaz. R$${storageFloor.toFixed(2)}/quinzena)`,
    'Como Otimizar Fator R e Economizar Impostos?',
    'Avaliador de Risco de Inadimplência e Fluxo de Caixa',
    'Viabilidade de Expansão para Galpão B no M36',
    'Comparar take rate CLIA vs economia de auditoria Forte',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="bg-[#1F3864] p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400/20 text-amber-300 rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Assistente CFO IA · Gemini 3.6</h3>
                <span className="text-[10px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.5 rounded uppercase">
                  Contexto field-driven
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Análise em tempo real do módulo{' '}
                <strong className="text-white">
                  {activeModule} ({moduleNames[activeModule] ?? activeModule})
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <button
            onClick={() =>
              handleAnalyze(
                `Diagnóstico Instantâneo do Módulo ${activeModule}: Avalie aderência ao BP, margens, Fator R (${fatorR}%), fluxo de caixa M24 (R$ ${activeScenario.m24Cash.toLocaleString('pt-BR')}) usando apenas context.*.`,
              )
            }
            disabled={loading}
            className="w-full bg-linear-to-r from-[#1F3864] via-[#2A4B82] to-[#1F3864] hover:from-[#152746] hover:to-[#152746] text-white font-bold p-3 rounded-xl shadow-md transition-all flex items-center justify-between group cursor-pointer border border-blue-900/50"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-400 text-slate-950 rounded-lg group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black tracking-wide text-amber-300 uppercase">
                  ⚡ Análise de Cenário Instantâneo · BP v3.6
                </div>
                <div className="text-[11px] text-blue-100 font-normal">
                  Diagnóstico do módulo <strong className="text-white">{activeModule}</strong> com payload completo
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-300 group-hover:translate-x-1 transition-transform" />
          </button>

          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Perguntas Frequentes do CFO
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(qp);
                    handleAnalyze(qp);
                  }}
                  className="text-xs font-medium text-gray-700 bg-gray-100 hover:bg-[#1F3864] hover:text-white px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1"
                >
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  <span>{qp}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 block">Sua pergunta ou instrução específica:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: O Fator R atual é seguro contra variações de faturamento?"
                className="flex-1 text-xs border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[#1F3864] focus:outline-hidden"
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
              <button
                onClick={() => handleAnalyze()}
                disabled={loading}
                className="bg-[#1F3864] hover:bg-[#1F3864]/90 text-white font-bold text-xs px-4 py-2 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analisando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Analisar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {loading && (
            <div className="p-8 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-center space-y-3">
              <Bot className="w-8 h-8 text-[#1F3864] animate-bounce mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-gray-800">Processando Análise...</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Enviando params, DRE, benchmarks Forte/SANCO e spine CLIA ao Gemini...
                </p>
              </div>
            </div>
          )}

          {analysis && !loading && (
            <div className="bg-canvas-bg border border-gray-200 rounded-lg p-4 space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F3864]">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Parecer do CFO Virtual</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="text-[11px] font-semibold text-gray-600 hover:text-[#1F3864] flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-2xs"
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : null}
                  <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>
              </div>

              <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-line font-sans">{analysis}</div>
            </div>
          )}
        </div>

        <div className="bg-gray-100 p-3 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
          <span>Powered by Gemini 3.6 · context field-driven v3.6</span>
          <button onClick={onClose} className="text-xs font-bold text-gray-700 hover:text-gray-900">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
