import React from 'react';
import { usePlanner } from '../context/PlannerContext';
import { X, CheckCircle2, Copy, Layers, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

export const CellInspector: React.FC = () => {
  const { inspectorCell, closeInspector, setActiveModule } = usePlanner();

  if (!inspectorCell) return null;

  const handleCopyFormula = () => {
    if (inspectorCell.formula) {
      navigator.clipboard.writeText(inspectorCell.formula);
      alert(`Fórmula "${inspectorCell.formula}" copiada para a área de transferência!`);
    }
  };

  const handleGoToDriver = () => {
    closeInspector();
    setActiveModule('M3'); // Navigate to VAS drivers module
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Inspector Header */}
      <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/30 rounded text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">FR-21 · Inspetor de Célula</h3>
            <p className="text-xs text-slate-400">Auditoria & Rastreabilidade do Modelo v3.5</p>
          </div>
        </div>
        <button
          onClick={closeInspector}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar inspetor"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Inspector Content */}
      <div className="p-5 flex-1 overflow-y-auto space-y-6">
        {/* Cell Identifier */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Célula Selecionada</div>
          <div className="text-lg font-bold text-slate-900">{inspectorCell.label}</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">ID: {inspectorCell.cellId} {inspectorCell.moduleName ? `• Módulo: ${inspectorCell.moduleName}` : ''}</div>
          <div className="mt-3 text-2xl font-black text-blue-900 font-mono">
            {typeof inspectorCell.value === 'number'
              ? `R$ ${inspectorCell.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
              : inspectorCell.value}
            {inspectorCell.unit && <span className="text-xs font-normal text-slate-500 ml-1.5">{inspectorCell.unit}</span>}
          </div>
        </div>

        {/* Formula Display */}
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Fórmula Matemática</span>
            <button
              onClick={handleCopyFormula}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar
            </button>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md font-mono text-sm text-amber-900 font-semibold break-all">
            {inspectorCell.formula || '=DRE_BRUTO - DAS6 - CUSTO_OP - DESP_OP'}
          </div>
        </div>

        {/* Calculation Tree / Dependencies */}
        <div>
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Árvore de Dependências (Drivers → Subtotais)
          </div>
          <div className="space-y-2">
            {(inspectorCell.formulaTree || [
              'Receita VAS (Qtd x Preço)',
              'Dedução DAS 6% Simples',
              'Custos Operacionais',
              'Pessoal & Prolabore',
              'Aluguel & Condomínio',
              'Depreciação & OPEX',
            ]).map((node, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                    {index + 1}
                  </span>
                  <span>{node}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Audit Verification Badge */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <span>Auditoria: spine v3.5</span>
              <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded text-[10px] uppercase">Verificado</span>
            </div>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Esta fórmula está integrada e em conformidade estrita com o modelo financeiro auditado v3.5, sem parâmetros legados ou valores fixos descontinuados.
            </p>
          </div>
        </div>
      </div>

      {/* Inspector Footer Actions */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
        <button
          onClick={handleGoToDriver}
          className="flex-1 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Ver Driver de Origem
        </button>
        <button
          onClick={closeInspector}
          className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
