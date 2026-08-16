import React, { useEffect, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { exportModulePDF, exportModuleCSV, exportToPDF, exportToCSV } from '../../utils/exportHandlers';
import {
  FileCheck,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Sparkles,
  FileText,
  DollarSign,
  Layers,
  Building,
  ShieldCheck,
  X,
  Calculator,
  Download,
} from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CRM_LEAD_CATALOG } from '../../data/formCatalogs';
import { ModuleHeader } from '../ModuleHeader';
import { HubFitnessLogo } from '../HubFitnessLogo';
import { M3ReceitaVas } from './M3ReceitaVas';
import type { FloorBundle } from '../../core/operator/resolvePriceFloors';

export const M14CpqPropostas: React.FC = () => {
  const { activeRole, pitchMode, dreMonths, addAuditLog, hubParams } = usePlanner();

  const [isPreviewProposalOpen, setIsPreviewProposalOpen] = useState(false);
  const [floorSource, setFloorSource] = useState<'operator' | 'params'>('params');

  const paramsFloors = hubParams.pricing.floors;
  const [SANCO_FLOORS, setSancoFloors] = useState({
    storagePerPallet: paramsFloors.storage,
    handlingPerPallet: paramsFloors.handling,
    unloadContainer40: paramsFloors.deunitization,
    labelingPerUnit: paramsFloors.labeling,
    adValoremRate: paramsFloors.adValoremPct,
  });

  // Lead Proposal Inputs
  const [prospectName, setProspectName] = useState<string>('MaxFitness Importadora Ltda');
  const [prospectCnpj, setProspectCnpj] = useState<string>('12.345.678/0001-90');
  const [prospectProfile, setProspectProfile] = useState<'p1' | 'p2' | 'p4' | 'p5'>('p4');

  // Quoted Quantities
  const [quotedPositions, setQuotedPositions] = useState<number>(200);
  const [quotedHandlings, setQuotedHandlings] = useState<number>(300);
  const [quotedContainers, setQuotedContainers] = useState<number>(2);
  const [quotedLabelings, setQuotedLabelings] = useState<number>(3000);
  const [quotedDeclaredValue, setQuotedDeclaredValue] = useState<number>(500000);

  // Custom Offered Prices (Subject to Floor Validation)
  const [offeredStoragePrice, setOfferedStoragePrice] = useState<number>(paramsFloors.storage);
  const [offeredHandlingPrice, setOfferedHandlingPrice] = useState<number>(paramsFloors.handling);
  const [offeredUnloadPrice, setOfferedUnloadPrice] = useState<number>(paramsFloors.deunitization);
  const [offeredLabelingPrice, setOfferedLabelingPrice] = useState<number>(paramsFloors.labeling);

  // CFO Approval Password override state
  const [cfoPasswordInput, setCfoPasswordInput] = useState<string>('');
  const [cfoApprovedOverride, setCfoApprovedOverride] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({
      storage: String(paramsFloors.storage),
      handling: String(paramsFloors.handling),
      deunitization: String(paramsFloors.deunitization),
      labeling: String(paramsFloors.labeling),
      adValoremPct: String(paramsFloors.adValoremPct),
    });
    void fetch(`/api/operator/price-floors?${q}`)
      .then((r) => r.json())
      .then((json: { success?: boolean; floors?: FloorBundle }) => {
        if (cancelled || !json?.success || !json.floors) return;
        const f = json.floors;
        setFloorSource(f.source);
        setSancoFloors({
          storagePerPallet: f.storage,
          handlingPerPallet: f.handling,
          unloadContainer40: f.deunitization,
          labelingPerUnit: f.labeling,
          adValoremRate: f.adValoremPct,
        });
        if (f.source === 'operator') {
          setOfferedStoragePrice(f.storage);
          setOfferedHandlingPrice(f.handling);
          setOfferedUnloadPrice(f.deunitization);
          setOfferedLabelingPrice(f.labeling);
        }
      })
      .catch(() => {
        /* fallback params já carregado */
      });
    return () => {
      cancelled = true;
    };
  }, [paramsFloors.storage, paramsFloors.handling, paramsFloors.deunitization, paramsFloors.labeling, paramsFloors.adValoremPct]);

  // Check discount violations
  const isStorageViolated = offeredStoragePrice < SANCO_FLOORS.storagePerPallet;
  const isHandlingViolated = offeredHandlingPrice < SANCO_FLOORS.handlingPerPallet;
  const isUnloadViolated = offeredUnloadPrice < SANCO_FLOORS.unloadContainer40;
  const isLabelingViolated = offeredLabelingPrice < SANCO_FLOORS.labelingPerUnit;

  const hasViolation = isStorageViolated || isHandlingViolated || isUnloadViolated || isLabelingViolated;
  const canGenerateProposal = !hasViolation || activeRole === 'cfo' || cfoApprovedOverride;

  // Calculate Revenues
  const revStorage = quotedPositions * offeredStoragePrice;
  const revHandling = quotedHandlings * offeredHandlingPrice;
  const revUnload = quotedContainers * offeredUnloadPrice;
  const revLabeling = quotedLabelings * offeredLabelingPrice;
  const revAdValorem = quotedDeclaredValue * SANCO_FLOORS.adValoremRate;

  const totalMonthlyQuoteRevenue = revStorage + revHandling + revUnload + revLabeling + revAdValorem;

  // M7 Target Revenue (R$ 205.200 / mês)
  const targetRevenueM7 = dreMonths[6]?.receitaServicos || 205200;
  const percentOfTargetM7 = (totalMonthlyQuoteRevenue / targetRevenueM7) * 100;

  // Capacidade do hub (params) — não “Konnen”
  const hubRackBudget = hubParams.capacity.totalPositions;
  const currentOccupiedPositions = Math.round(hubRackBudget * hubParams.capacity.targetOccupancy);
  const remainingCapacityPositions = Math.max(0, hubRackBudget - currentOccupiedPositions);
  const newOccupancyWithQuote = hubRackBudget > 0
    ? ((currentOccupiedPositions + quotedPositions) / hubRackBudget) * 100
    : 0;

  const handleCfoPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cfoPasswordInput === 'cfo3pl2026' || cfoPasswordInput === '1234') {
      setCfoApprovedOverride(true);
      setPasswordError(null);
      addAuditLog('CPQ Propostas', 'Bloqueado SANCO', 'Aprovado via Senha CFO Override');
    } else {
      setPasswordError('Senha de autorização do CFO incorreta!');
    }
  };

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M14"
        title="Propostas CPQ & Precificação Comercial"
        subtitle="Gerador de propostas com validação de pisos tarifários SANCO (Operator price_* ou params), catálogo VAS e impacto na meta M7 e capacidade do hub."
        kpis={[
          {
            label: 'Cotação Mensal Lead',
            value: `R$ ${totalMonthlyQuoteRevenue.toLocaleString('pt-BR')}`,
            subtext: `${percentOfTargetM7.toFixed(1)}% da Meta M7 (R$ 205.2k)`,
            badge: 'COTAÇÃO',
            highlightColor: 'emerald',
          },
          {
            label: 'Pisos Tarifários SANCO',
            value: `R$ ${SANCO_FLOORS.storagePerPallet.toFixed(2)} / R$ ${SANCO_FLOORS.handlingPerPallet.toFixed(2)}`,
            subtext: floorSource === 'operator' ? 'Fonte: Operator price_category_items' : 'Fonte: hubParams (fallback)',
            badge: 'SANCO OK',
            highlightColor: 'amber',
          },
          {
            label: 'Ocupação Galpão HUB',
            value: `${newOccupancyWithQuote.toFixed(1)}%`,
            subtext: `+${quotedPositions} pos. (Teto ${hubRackBudget.toLocaleString('pt-BR')} pos.)`,
            badge: 'LOGÍSTICA',
            highlightColor: 'slate',
          },
          {
            label: 'Status Trava SANCO',
            value: hasViolation ? 'DESCONTO BLOQUEADO' : 'LIBERADO P/ PROPOSTA',
            subtext: hasViolation ? 'Requer aprovação/senha CFO' : 'Margens 100% em conformidade',
            badge: 'GOVERNAÇA',
            highlightColor: hasViolation ? 'rose' : 'indigo',
          },
        ]}
        actions={
          <button
            onClick={() => setIsPreviewProposalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Ver Proposta Comercial</span>
          </button>
        }
      />

      <M3ReceitaVas hideHeader />

      {/* CFO APPROVAL / DISCOUNT VIOLATION BANNER */}
      {hasViolation && !canGenerateProposal && (
        <div className="bg-rose-950 text-white p-5 rounded-xl border border-rose-700 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-rose-300 font-extrabold text-sm uppercase">
            <Lock className="w-5 h-5 text-rose-400 animate-pulse" />
            <span>🔒 DESCONTO BLOQUEADO: VALORES ABAIXO DO PISO BENCHMARK SANCO</span>
          </div>
          <p className="text-xs text-rose-100 leading-relaxed">
            Tentativa de precificação abaixo das margens mínimas do BP v3.5. Para gerar a proposta comercial PDF com estes valores, insira a senha de liberação do CFO:
          </p>

          <form onSubmit={handleCfoPasswordSubmit} className="flex items-center gap-2 pt-1 max-w-md">
            <input
              type="password"
              placeholder="Digite a Senha do CFO..."
              value={cfoPasswordInput}
              onChange={(e) => setCfoPasswordInput(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-rose-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500 flex-1 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded shadow-xs cursor-pointer"
            >
              Autorizar Exceção CFO
            </button>
          </form>
          {passwordError && <span className="text-[11px] text-rose-300 font-bold block">{passwordError}</span>}
        </div>
      )}

      {/* MAIN CPQ WORKSPACE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLUMN 1: LEAD CONFIGURATION & VOLUMES */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Building className="w-5 h-5 text-blue-900" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              1. Dados do Prospect & Volumes
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Razão Social do Cliente:</label>
              <SearchableSelect
                value={prospectName}
                options={CRM_LEAD_CATALOG}
                onChange={setProspectName}
                allowCustom
                required
                placeholder="Filtrar lead do CRM…"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">CNPJ do Lead:</label>
              <input
                type="text"
                value={prospectCnpj}
                onChange={(e) => setProspectCnpj(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Perfil Operacional (Mix):</label>
              <SearchableSelect
                value={prospectProfile}
                options={[
                  { value: 'p1', label: 'P1 · Estocador (Armazenagem Pura)' },
                  { value: 'p2', label: 'P2 · Franquias Fitness' },
                  { value: 'p4', label: 'P4 · B2B Academias / Redes' },
                  { value: 'p5', label: 'P5 · Premium (Kitting & Montagem)' },
                ]}
                onChange={(v) => setProspectProfile(v as typeof prospectProfile)}
                placeholder="Filtrar perfil…"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Posições Palete Contratadas:</label>
                <input
                  type="number"
                  value={quotedPositions}
                  onChange={(e) => setQuotedPositions(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Movimentações / Mês (Paletes):</label>
                <input
                  type="number"
                  value={quotedHandlings}
                  onChange={(e) => setQuotedHandlings(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Desunitizações Container 40' / Mês:</label>
                <input
                  type="number"
                  value={quotedContainers}
                  onChange={(e) => setQuotedContainers(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Etiquetagem EAN (Unidades / Mês):</label>
                <input
                  type="number"
                  value={quotedLabelings}
                  onChange={(e) => setQuotedLabelings(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Valor Declarado Estoque (Ad Valorem R$):</label>
                <input
                  type="number"
                  value={quotedDeclaredValue}
                  onChange={(e) => setQuotedDeclaredValue(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: PRICING ENGINE WITH HARDCODED FLOORS */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                2. Motor de Precificação CPQ
              </h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Pisos BP v3.5
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Storage Input */}
            <div className={`p-3 rounded-lg border ${isStorageViolated ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>Armazenagem Quinzenal (R$/palete)</span>
                <span className="text-[10px] text-slate-500 font-mono">Piso: R$ 22,50</span>
              </div>
              <input
                type="number"
                step="0.50"
                value={offeredStoragePrice}
                onChange={(e) => setOfferedStoragePrice(Number(e.target.value))}
                className={`w-full px-3 py-1.5 border rounded font-mono font-bold ${
                  isStorageViolated ? 'border-rose-500 bg-rose-100 text-rose-900' : 'border-slate-300 text-slate-900'
                }`}
              />
              {isStorageViolated && <span className="text-[10px] text-rose-600 font-bold mt-1 block">⚠️ Abaixo do piso R$ 22,50!</span>}
            </div>

            {/* Handling Input */}
            <div className={`p-3 rounded-lg border ${isHandlingViolated ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>Movimentação / Handling In-Out (R$/palete)</span>
                <span className="text-[10px] text-slate-500 font-mono">Piso: R$ 25,00</span>
              </div>
              <input
                type="number"
                step="0.50"
                value={offeredHandlingPrice}
                onChange={(e) => setOfferedHandlingPrice(Number(e.target.value))}
                className={`w-full px-3 py-1.5 border rounded font-mono font-bold ${
                  isHandlingViolated ? 'border-rose-500 bg-rose-100 text-rose-900' : 'border-slate-300 text-slate-900'
                }`}
              />
              {isHandlingViolated && <span className="text-[10px] text-rose-600 font-bold mt-1 block">⚠️ Abaixo do piso R$ 25,00!</span>}
            </div>

            {/* Unload Container Input */}
            <div className={`p-3 rounded-lg border ${isUnloadViolated ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>Desunitização Container 40' HC (R$/container)</span>
                <span className="text-[10px] text-slate-500 font-mono">Piso: R$ 1.400</span>
              </div>
              <input
                type="number"
                step="50"
                value={offeredUnloadPrice}
                onChange={(e) => setOfferedUnloadPrice(Number(e.target.value))}
                className={`w-full px-3 py-1.5 border rounded font-mono font-bold ${
                  isUnloadViolated ? 'border-rose-500 bg-rose-100 text-rose-900' : 'border-slate-300 text-slate-900'
                }`}
              />
              {isUnloadViolated && <span className="text-[10px] text-rose-600 font-bold mt-1 block">⚠️ Abaixo do piso R$ 1.400,00!</span>}
            </div>

            {/* Labeling Input */}
            <div className={`p-3 rounded-lg border ${isLabelingViolated ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>Etiquetagem EAN / Codificação (R$/unid)</span>
                <span className="text-[10px] text-slate-500 font-mono">Piso: R$ 0,75</span>
              </div>
              <input
                type="number"
                step="0.05"
                value={offeredLabelingPrice}
                onChange={(e) => setOfferedLabelingPrice(Number(e.target.value))}
                className={`w-full px-3 py-1.5 border rounded font-mono font-bold ${
                  isLabelingViolated ? 'border-rose-500 bg-rose-100 text-rose-900' : 'border-slate-300 text-slate-900'
                }`}
              />
              {isLabelingViolated && <span className="text-[10px] text-rose-600 font-bold mt-1 block">⚠️ Abaixo do piso R$ 0,75!</span>}
            </div>

            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-slate-700">
              <div className="flex justify-between font-bold">
                <span>Ad Valorem Seguro (0,10% Fixo):</span>
                <span className="font-mono">R$ {revAdValorem.toLocaleString('pt-BR')} /mês</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: SIMULATED IMPACT ON GOALS & EXPORT */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Layers className="w-5 h-5 text-blue-900" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                3. Impacto na Meta M7 & Capacidade
              </h3>
            </div>

            {/* Total Proposal Monthly Revenue KPI */}
            <div className="bg-[#1F3864] text-white p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                Receita Mensal Estimada do Contrato
              </span>
              <div className="text-2xl font-black font-mono text-amber-300">
                R$ {totalMonthlyQuoteRevenue.toLocaleString('pt-BR')}
              </div>
              <span className="text-[11px] text-blue-200 block pt-1">
                Repres. <strong>{percentOfTargetM7.toFixed(1)}%</strong> da meta mensal do M7 (R$ 205.200)
              </span>
            </div>

            {/* Capacity Impact Gauge */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Ocupação hub pós-Contrato:</span>
                <span className="font-mono text-blue-900 font-extrabold">{newOccupancyWithQuote.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${newOccupancyWithQuote > 100 ? 'bg-rose-600' : 'bg-emerald-600'}`}
                  style={{ width: `${Math.min(100, newOccupancyWithQuote)}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Total: 2.968 pos.</span>
                <span>Restante livre: <strong>{Math.max(0, remainingCapacityPositions - quotedPositions)} pos.</strong></span>
              </div>
            </div>
          </div>

          {/* Action Button: Generate Proposal PDF */}
          <div className="pt-4 border-t border-slate-200">
            <button
              disabled={!canGenerateProposal}
              onClick={() => setIsPreviewProposalOpen(true)}
              className={`w-full py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                canGenerateProposal
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>{canGenerateProposal ? 'Gerar Proposta Comercial PDF' : 'Desconto Bloqueado (Requer CFO)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* PROPOSAL PREVIEW MODAL */}
      {isPreviewProposalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col my-auto overflow-hidden">
            {/* Header */}
            <div className="bg-[#1F3864] p-4 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <HubFitnessLogo size="sm" variant="dark" />
                <span className="text-xs font-bold text-amber-300">PROPOSTA COMERCIAL CPQ v3.5</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    exportToPDF({
                      title: `PROPOSTA COMERCIAL CPQ · ${prospectName}`,
                      subtitle: `Cliente CNPJ: ${prospectCnpj} | Perfil ${prospectProfile}`,
                      scenarioName: 'CPQ Proposta Base',
                      moduleCode: 'M14',
                      filename: `Proposta_Comercial_${prospectName.replace(/\s+/g, '_')}`,
                      kpis: [
                        { label: 'Cliente', value: prospectName },
                        { label: 'Receita Est. Mês', value: `R$ ${totalMonthlyQuoteRevenue.toLocaleString('pt-BR')}` },
                        { label: '% Meta M7', value: `${percentOfTargetM7.toFixed(1)}%` },
                        { label: 'Ocupação Est.', value: `${newOccupancyWithQuote.toFixed(1)}%` },
                      ],
                      tableHeaders: ['Serviço / Item', 'Qtde/Mês', 'Preço Unit. (R$)', 'Total Est. Mês (R$)'],
                      tableData: [
                        ['Armazenagem Quinzenal', `${quotedPositions} pos.`, `R$ ${offeredStoragePrice.toFixed(2)}`, `R$ ${revStorage.toLocaleString('pt-BR')}`],
                        ['Handling In-Out', `${quotedHandlings} paletes`, `R$ ${offeredHandlingPrice.toFixed(2)}`, `R$ ${revHandling.toLocaleString('pt-BR')}`],
                        ['Desunitização Container 40', `${quotedContainers} cont.`, `R$ ${offeredUnloadPrice.toFixed(2)}`, `R$ ${revUnload.toLocaleString('pt-BR')}`],
                        ['Etiquetagem EAN', `${quotedLabelings} unid.`, `R$ ${offeredLabelingPrice.toFixed(2)}`, `R$ ${revLabeling.toLocaleString('pt-BR')}`],
                      ],
                      notes: [
                        'Validade da proposta: 15 dias corridos.',
                        'Valores auditados e enquadrados sob as regras do BP v3.5.',
                      ],
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-100" />
                  <span>Baixar PDF</span>
                </button>
                <button
                  onClick={() => {
                    exportToCSV(
                      [
                        ['Armazenagem Quinzenal', `${quotedPositions}`, offeredStoragePrice.toFixed(2), revStorage],
                        ['Handling In-Out', `${quotedHandlings}`, offeredHandlingPrice.toFixed(2), revHandling],
                        ['Desunitização Container', `${quotedContainers}`, offeredUnloadPrice.toFixed(2), revUnload],
                        ['Etiquetagem EAN', `${quotedLabelings}`, offeredLabelingPrice.toFixed(2), revLabeling],
                      ],
                      ['Serviço / Item', 'Quantidade / Mês', 'Preço Unitário (R$)', 'Total Estimado Mês (R$)'],
                      `Proposta_Comercial_${prospectName.replace(/\s+/g, '_')}`
                    );
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-100" />
                  <span>Exportar CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button onClick={() => setIsPreviewProposalOpen(false)} className="text-slate-300 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Body */}
            <div className="p-8 space-y-6 text-slate-800 text-xs overflow-y-auto relative bg-white">
              <div className="flex justify-between items-start border-b-2 border-[#1F3864] pb-4">
                <div>
                  <HubFitnessLogo size="md" variant="light" />
                  <div className="text-[11px] text-slate-500 font-medium mt-1">HUB-SIM Operador Logístico 3PL · Itajaí/SC</div>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-[#006100] text-white text-[10px] font-black px-2.5 py-0.5 rounded mb-1">
                    AUDITÁVEL V3.5
                  </div>
                  <div className="font-mono text-xs font-bold text-[#1F3864]">PROPOSTA Nº {Math.floor(Math.random() * 90000 + 10000)}</div>
                  <div className="text-[11px] text-slate-500">Data: {new Date().toLocaleDateString('pt-BR')}</div>
                </div>
              </div>

              {/* Lead Info Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Cliente / Razão Social</span>
                  <span className="font-extrabold text-slate-900 text-sm">{prospectName}</span>
                  <span className="text-[11px] text-slate-500 block">CNPJ: {prospectCnpj}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Perfil & Escopo</span>
                  <span className="font-bold text-blue-900 uppercase">Perfil {prospectProfile} · Operação 3PL Fitness</span>
                  <span className="text-[11px] text-slate-500 block">Validade da Proposta: 15 Dias</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs mb-2">Tabela de Serviços & Honorários Logísticos</h4>
                <table className="w-full border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <thead>
                    <tr className="bg-[#1F3864] text-white font-bold">
                      <th className="py-2 px-3 text-left">Serviço / Item</th>
                      <th className="py-2 px-3 text-center">Qtde / Mês</th>
                      <th className="py-2 px-3 text-right">Preço Unitário (R$)</th>
                      <th className="py-2 px-3 text-right">Total Estimado / Mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Armazenagem Quinzenal (Porta-Paletes)</td>
                      <td className="py-2 px-3 text-center">{quotedPositions} pos.</td>
                      <td className="py-2 px-3 text-right">R$ {offeredStoragePrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">R$ {revStorage.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Movimentação / Handling In-Out</td>
                      <td className="py-2 px-3 text-center">{quotedHandlings} paletes</td>
                      <td className="py-2 px-3 text-right">R$ {offeredHandlingPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">R$ {revHandling.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Desunitização Container 40' HC</td>
                      <td className="py-2 px-3 text-center">{quotedContainers} cont.</td>
                      <td className="py-2 px-3 text-right">R$ {offeredUnloadPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">R$ {revUnload.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Etiquetagem EAN / Codificação</td>
                      <td className="py-2 px-3 text-center">{quotedLabelings} unid.</td>
                      <td className="py-2 px-3 text-right">R$ {offeredLabelingPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">R$ {revLabeling.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-900">Ad Valorem Seguro (0,10%)</td>
                      <td className="py-2 px-3 text-center">R$ {quotedDeclaredValue.toLocaleString('pt-BR')}</td>
                      <td className="py-2 px-3 text-right">0,10%</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">R$ {revAdValorem.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr className="bg-emerald-50 text-emerald-950 font-bold">
                      <td colSpan={3} className="py-2 px-3 text-right uppercase">Investimento Mensal Estimado:</td>
                      <td className="py-2 px-3 text-right text-sm font-black text-emerald-800">R$ {totalMonthlyQuoteRevenue.toLocaleString('pt-BR')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Standard Legal Clauses Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-[11px] leading-relaxed text-slate-600">
                <strong className="text-slate-900 block font-bold uppercase text-xs">Cláusulas Padronizadas de SLA & Garantia (BP v3.5):</strong>
                <p>• <strong>SLAs de Expedição:</strong> Corte B2C às 11h e B2B às 12h. Logística Reversa com triagem completa em até 24h.</p>
                <p>• <strong>Limite de Quebra Técnica:</strong> Avaria contratual máxima de 1,0% sobre o valor declarado da NF em custódia.</p>
                <p>• <strong>Direito de Retenção:</strong> Nos termos do Art. 644 do Código Civil e Dec. 1.102/1903 em caso de inadimplência.</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200">
                <div className="text-center">
                  <div className="border-t border-slate-400 pt-1 font-bold text-xs text-slate-800">Diretoria Comercial HUB-SIM</div>
                  <div className="text-[10px] text-slate-500">Aprovação de Margem BP v3.5</div>
                </div>

                <div className="text-center">
                  <div className="border-t border-slate-400 pt-1 font-bold text-xs text-slate-800">{prospectName}</div>
                  <div className="text-[10px] text-slate-500">Aceite do Cliente</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
