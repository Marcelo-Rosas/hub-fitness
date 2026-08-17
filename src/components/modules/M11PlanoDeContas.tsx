import React, { useState, useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  ACCOUNTING_RULES,
  AccountItem,
} from '../../data/planoDeContasData';
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Copy,
  ChevronRight,
  ChevronDown,
  Layers,
  Calculator,
  Building,
  Info,
  ShieldCheck,
  Percent,
  Check,
  Tag,
  FileText,
  DollarSign,
} from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CoaMaeFilha } from '../CoaMaeFilha';

export const M11PlanoDeContas: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
  const { dreMonths, activeScenario, chartOfAccounts, costCenters, hubParams, financeSource } = usePlanner();

  const [activeTab, setActiveTab] = useState<'plan' | 'rules' | 'fatorRValidator' | 'export'>('plan');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('TODOS');
  const [selectedLevel, setSelectedLevel] = useState<string>('TODOS');
  const [onlyFatorR, setOnlyFatorR] = useState(false);
  const [onlyAnalytic, setOnlyAnalytic] = useState(false);
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({
    '1': true,
    '1.1': true,
    '1.2': true,
    '2': true,
    '2.1': true,
    '3': true,
    '4': true,
    '4.1': true,
    '4.2': true,
    '5': true,
    '5.1': true,
    '5.2': true,
  });

  const [selectedAccountModal, setSelectedAccountModal] = useState<AccountItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'dominio' | 'questor' | 'txt'>('csv');

  // Simulator State for Fator R Validator
  const [simulatedRbt12, setSimulatedRbt12] = useState<number>(2450000);
  const [simulatedSalarios, setSimulatedSalarios] = useState<number>(35000);
  const [simulatedProLaboreRegular, setSimulatedProLaboreRegular] = useState<number>(
    hubParams.fiscal.plBaseMonthly,
  );
  const [simulatedProLaboreAdicional, setSimulatedProLaboreAdicional] = useState<number>(3820);
  const [simulatedFgtsInss, setSimulatedFgtsInss] = useState<number>(4500);
  const [simulatedTerceirizados, setSimulatedTerceirizados] = useState<number>(12000);

  // Toggle accordion expansion
  const toggleCodeExpansion = (code: string) => {
    setExpandedCodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    chartOfAccounts.forEach((item) => {
      allExpanded[item.code] = true;
    });
    setExpandedCodes(allExpanded);
  };

  const collapseAll = () => {
    setExpandedCodes({
      '1': true,
      '2': true,
      '3': true,
      '4': true,
      '5': true,
    });
  };

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return chartOfAccounts.filter((item) => {
      // Group Filter
      if (selectedGroup !== 'TODOS' && item.group !== selectedGroup) return false;
      // Level Filter
      if (selectedLevel !== 'TODOS' && item.level.toString() !== selectedLevel) return false;
      // Only Fator R
      if (onlyFatorR && !item.isFatorRNumerator && !item.isCriticalFatorR && !item.isFatorRExcluded) return false;
      // Only Analytic
      if (onlyAnalytic && item.type !== 'Analítica') return false;
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCode = item.code.toLowerCase().includes(query);
        const matchName = item.name.toLowerCase().includes(query);
        const matchNotes = item.notes?.toLowerCase().includes(query) || false;
        if (!matchCode && !matchName && !matchNotes) return false;
      }
      return true;
    });
  }, [searchTerm, selectedGroup, selectedLevel, onlyFatorR, onlyAnalytic]);

  // Statistics
  const totalAccounts = chartOfAccounts.length;
  const analyticCount = chartOfAccounts.filter((i) => i.type === 'Analítica').length;
  const sinteticCount = chartOfAccounts.filter((i) => i.type === 'Sintética').length;
  const fatorRCount = chartOfAccounts.filter((i) => i.isFatorRNumerator).length;

  // Fator R Simulator Calculations
  const totalFolhaMensal = simulatedSalarios + simulatedProLaboreRegular + simulatedProLaboreAdicional + simulatedFgtsInss;
  const totalFolhaAnual = totalFolhaMensal * 12;
  const calculatedFatorR = simulatedRbt12 > 0 ? (totalFolhaAnual / simulatedRbt12) * 100 : 0;
  const isAnexo3Ok = calculatedFatorR >= 28.0;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Export Data Builder
  const handleExportPlano = () => {
    let content = '';
    let filename = `Plano_de_Contas_3PL_Fitness_Hub_${exportFormat.toUpperCase()}`;

    if (exportFormat === 'csv') {
      filename += '.csv';
      content = 'Codigo;Nome;Nivel;Grupo;Natureza;Tipo;Centro_Custo;Fator_R;Observacoes\n';
      chartOfAccounts.forEach((i) => {
        content += `"${i.code}";"${i.name}";${i.level};"${i.group}";"${i.nature}";"${i.type}";"${i.costCenterId || ''}";"${
          i.isFatorRNumerator ? 'NUMERADOR' : i.isFatorRExcluded ? 'EXCLUIDO' : 'N/A'
        }";"${(i.notes || '').replace(/"/g, '""')}"\n`;
      });
    } else if (exportFormat === 'json') {
      filename += '.json';
      content = JSON.stringify(chartOfAccounts, null, 2);
    } else if (exportFormat === 'dominio') {
      filename += '_DOMINIO.txt';
      content = '=====================================================\n';
      content += 'SISTEMA DOMÍNIO CONTÁBIL - IMPORTAÇÃO DE PLANO DE CONTAS\n';
      content += 'EMPRESA: 3PL FITNESS HUB ITAJAÍ LTDA - SIMPLES NACIONAL (ANEXO III)\n';
      content += '=====================================================\n\n';
      chartOfAccounts.forEach((i) => {
        const paddedCode = i.code.padEnd(15, ' ');
        const typeFlag = i.type === 'Analítica' ? 'A' : 'S';
        const natFlag = i.nature === 'Devedora' ? 'D' : 'C';
        content += `${paddedCode} | ${typeFlag} | ${natFlag} | ${i.name}\n`;
      });
    } else if (exportFormat === 'questor') {
      filename += '_QUESTOR.txt';
      content = 'QUESTOR_PLANO_CONTAS_v3.5\n';
      chartOfAccounts.forEach((i) => {
        content += `${i.code}|${i.name}|${i.type === 'Analítica' ? '2' : '1'}|${i.nature === 'Devedora' ? '1' : '2'}|${
          i.costCenterId || '001'
        }\n`;
      });
    } else {
      filename += '.txt';
      content = 'PLANO DE CONTAS REFERENCIAL PCASP - 3PL FITNESS HUB ITAJAÍ\n';
      content += '===========================================================\n\n';
      chartOfAccounts.forEach((i) => {
        const indent = '  '.repeat(i.level - 1);
        content += `${indent}${i.code} - ${i.name} [${i.type}] (${i.nature})\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* MODULE TOP BANNER */}
      <div className="bg-linear-to-r from-[#1F3864] via-[#2A4B82] to-[#1F3864] text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-yellow-300 via-emerald-400 to-transparent pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                Estrutura Oficial PCASP / PMEs
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-semibold px-2 py-0.5 rounded">
                Simples Nacional (Anexo III)
              </span>
              <span className="bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-semibold px-2 py-0.5 rounded">
                HUB-SIM v3.5
              </span>
              <span
                className={`${
                  financeSource === 'operator'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                    : 'bg-slate-500/20 text-slate-200 border-slate-400/30'
                } border text-[10px] font-semibold px-2 py-0.5 rounded`}
              >
                Fonte: {financeSource === 'operator' ? 'Operator' : 'seed local'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-amber-400" />
              <span>Plano de Contas Referencial Contábil</span>
            </h1>
            <p className="text-xs text-blue-100 max-w-3xl mt-1 leading-relaxed">
              Estruturação codificada em decimais (1.1.01...) para integração com Domínio, Questor e Conta Azul.
              Mapeamento analítico de **Centros de Custos (CC 001 a CC 005)**, **Ativação CAPEX (R${' '}
              {hubParams.capex.total.toLocaleString('pt-BR')})** e **Regra do Fator R (
              {hubParams.fiscal.fatorRFloor.toFixed(1).replace('.', ',')}%)**.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPlano}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Plano ({exportFormat.toUpperCase()})</span>
            </button>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
            <div className="text-white/60 text-[10px] uppercase font-semibold">Total de Contas</div>
            <div className="text-lg font-black text-amber-300">{totalAccounts} Linhas</div>
            <div className="text-[10px] text-white/50">{sinteticCount} Sintéticas | {analyticCount} Analíticas</div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
            <div className="text-white/60 text-[10px] uppercase font-semibold">Fator R (Numerador)</div>
            <div className="text-lg font-black text-emerald-300">{fatorRCount} Contas</div>
            <div className="text-[10px] text-emerald-200">Pró-Labore, Salários & Encargos</div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
            <div className="text-white/60 text-[10px] uppercase font-semibold">Centros de Custos</div>
            <div className="text-lg font-black text-blue-300">5 CCs Globais</div>
            <div className="text-[10px] text-blue-200">CC 001 a CC 005 Tagged</div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-lg border border-white/10">
            <div className="text-white/60 text-[10px] uppercase font-semibold">Alíquota Unificada</div>
            <div className="text-lg font-black text-purple-300">6.0% DAS</div>
            <div className="text-[10px] text-purple-200">Conta Dedução 4.2.01.01</div>
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold">
          Edição de contas e centros: Cadastro financeiro (M3).
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 gap-2 shadow-xs">
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'plan'
              ? 'border-[#1F3864] text-[#1F3864] bg-slate-50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-500" />
          <span>Estrutura de Contas ({filteredAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'rules'
              ? 'border-[#1F3864] text-[#1F3864] bg-slate-50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Regras Contábeis & Centros de Custos</span>
        </button>

        <button
          onClick={() => setActiveTab('fatorRValidator')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'fatorRValidator'
              ? 'border-[#1F3864] text-[#1F3864] bg-slate-50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Percent className="w-4 h-4 text-purple-600" />
          <span>Simulador & Validador Fator R (Contas Mapeadas)</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'export'
              ? 'border-[#1F3864] text-[#1F3864] bg-slate-50 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <span>Exportação para ERPs (Domínio/Questor)</span>
        </button>
      </div>

      {/* TAB 1: ESTRUTURA DE CONTAS */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por código (ex: 5.2.01.03), nome ou observaçoes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#1F3864] focus:bg-white transition-all"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <SearchableSelect
                value={selectedGroup}
                options={[
                  { value: 'TODOS', label: 'Todos os Grupos (1 a 5)' },
                  { value: 'ATIVO', label: '1. ATIVO' },
                  { value: 'PASSIVO', label: '2. PASSIVO' },
                  { value: 'PATRIMÔNIO LÍQUIDO', label: '3. PATRIMÔNIO LÍQUIDO' },
                  { value: 'RECEITAS', label: '4. RECEITAS' },
                  { value: 'CUSTOS E DESPESAS', label: '5. CUSTOS E DESPESAS' },
                ]}
                onChange={setSelectedGroup}
                placeholder="Filtrar grupo…"
              />

              <SearchableSelect
                value={selectedLevel}
                options={[
                  { value: 'TODOS', label: 'Todos os Níveis (1 a 4)' },
                  { value: '1', label: 'Nível 1 (Sintética Principal)' },
                  { value: '2', label: 'Nível 2 (Sintética Subgrupo)' },
                  { value: '3', label: 'Nível 3 (Sintética Categoria)' },
                  { value: '4', label: 'Nível 4 (Analítica de Lançamento)' },
                ]}
                onChange={setSelectedLevel}
                placeholder="Filtrar nível…"
              />

              <button
                onClick={() => setOnlyFatorR(!onlyFatorR)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                  onlyFatorR
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 text-emerald-800 border-gray-200 hover:bg-emerald-50'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Somente Fator R</span>
              </button>

              <button
                onClick={() => setOnlyAnalytic(!onlyAnalytic)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                  onlyAnalytic
                    ? 'bg-[#1F3864] text-white border-blue-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-gray-200 hover:bg-slate-100'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Apenas Analíticas</span>
              </button>

              <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded cursor-pointer"
              >
                Expandir Tudo
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded cursor-pointer"
              >
                Recolher
              </button>
            </div>
          </div>

          {/* TABLE / HIERARCHICAL LIST */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1F3864] text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-36">Código Decimal</th>
                    <th className="py-3 px-4">Nome da Conta Contábil</th>
                    <th className="py-3 px-4 w-28 text-center">Tipo</th>
                    <th className="py-3 px-4 w-28 text-center">Natureza</th>
                    <th className="py-3 px-4 w-28 text-center">Centro Custo</th>
                    <th className="py-3 px-4 w-36 text-center">Classificação Especial</th>
                    <th className="py-3 px-4 w-16 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-sans">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        Nenhuma conta contábil encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((account) => {
                      const isSintetic = account.type === 'Sintética';
                      const isExpanded = expandedCodes[account.code] ?? true;

                      // Level indent
                      const paddingLeft = (account.level - 1) * 1.5;

                      return (
                        <tr
                          key={account.code}
                          className={`hover:bg-amber-50/50 transition-colors ${
                            account.level === 1
                              ? 'bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300'
                              : account.level === 2
                              ? 'bg-slate-50 font-bold text-slate-800'
                              : account.level === 3
                              ? 'bg-white font-semibold text-slate-700'
                              : 'bg-white text-gray-600'
                          } ${account.isCriticalFatorR ? 'bg-amber-50/80 border-l-4 border-amber-500' : ''}`}
                        >
                          {/* Code */}
                          <td className="py-2.5 px-4 font-mono font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${paddingLeft}rem` }}>
                              {isSintetic ? (
                                <button
                                  onClick={() => toggleCodeExpansion(account.code)}
                                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-3.5 inline-block"></span>
                              )}
                              <span className={account.level === 1 ? 'text-[#1F3864] text-sm' : ''}>
                                {account.type === 'Analítica' ? (
                                  <CoaMaeFilha accountCode={account.code} show="pair" tone="light" />
                                ) : (
                                  account.code
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Name */}
                          <td className="py-2.5 px-4 font-medium">
                            <div className="flex items-center gap-2">
                              <span
                                className={`${
                                  account.level === 1
                                    ? 'font-black text-sm text-[#1F3864]'
                                    : account.level === 2
                                    ? 'font-bold text-slate-800'
                                    : account.level === 3
                                    ? 'font-semibold text-slate-700'
                                    : 'text-gray-700'
                                }`}
                              >
                                {account.name}
                              </span>

                              {account.isCriticalFatorR && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                  🔒 Fator R Crítico
                                </span>
                              )}

                              {account.isDasTax && (
                                <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[9.5px] font-bold px-1.5 py-0.5 rounded">
                                  ⚡ DAS 6%
                                </span>
                              )}

                              {account.isCapex && (
                                <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[9.5px] font-bold px-1.5 py-0.5 rounded">
                                  🏗️ CAPEX
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                account.type === 'Sintética'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {account.type}
                            </span>
                          </td>

                          {/* Nature */}
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                account.nature === 'Devedora'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {account.nature}
                            </span>
                          </td>

                          {/* Cost Center */}
                          <td className="py-2.5 px-4 text-center">
                            {account.costCenterId ? (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">
                                {account.costCenterId}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-[10px]">-</span>
                            )}
                          </td>

                          {/* Classification */}
                          <td className="py-2.5 px-4 text-center">
                            {account.isFatorRNumerator ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                                (+) Numerador Fator R
                              </span>
                            ) : account.isFatorRExcluded ? (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200">
                                ❌ Excluído Fator R
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">Geral</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedAccountModal(account)}
                              className="text-blue-700 hover:text-blue-900 hover:bg-blue-50 p-1.5 rounded transition-colors cursor-pointer"
                              title="Inspecionar Detalhes da Conta"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGRAS CONTÁBEIS & CENTROS DE CUSTOS */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* COST CENTERS GRID */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
            <h2 className="text-base font-bold text-[#1F3864] flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-amber-500" />
              <span>Centros de Custos Globais (Taggeamento de Lançamentos CC 001 a CC 005)</span>
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Conforme definido no plano de contas, os lançamentos financeiros devem utilizar centros de custos
              analíticos para permitir apurar o custo exato por posição palete ocupada (alvo do ledger CV /
              conta 5.1.04.01).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {costCenters.map((cc) => (
                <div key={cc.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-[#1F3864] text-white font-mono text-xs font-black px-2 py-0.5 rounded">
                      {cc.id}
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                      Tag Ativo
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{cc.name}</h3>
                  <p className="text-xs text-slate-600 mb-3">{cc.description}</p>

                  <div className="text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="text-slate-500">
                      <strong>Escopo de Gastos:</strong> {cc.scope}
                    </div>
                    <div className="text-blue-900 font-semibold pt-1 border-t border-slate-100">
                      <strong>KPI Chave:</strong> {cc.recommendedKPI}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACCOUNTING RULES CARDS */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
            <h2 className="text-base font-bold text-[#1F3864] flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Regras Principais de Contabilização e Lançamento</span>
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Diretrizes contábeis indispensáveis para o correto funcionamento da DRE, do cálculo do Fator R e do encerramento de balanço.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACCOUNTING_RULES.map((rule) => (
                <div key={rule.id} className="border border-slate-200 rounded-xl p-5 bg-linear-to-br from-white to-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                      {rule.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Regra #{rule.id}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1">{rule.title}</h3>
                  <p className="text-xs font-semibold text-[#1F3864] mb-3">{rule.summary}</p>

                  <div className="bg-slate-100 p-3 rounded-lg text-xs text-slate-700 leading-relaxed mb-3">
                    {rule.ruleDetail}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500">Contas Envolvidas:</span>
                    {rule.accountsInvolved.map((code) => (
                      <span key={code} className="bg-white border border-slate-200 text-slate-800 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SIMULADOR & VALIDADOR FATOR R */}
      {activeTab === 'fatorRValidator' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#1F3864] flex items-center gap-2 mb-1">
              <Calculator className="w-5 h-5 text-purple-600" />
              <span>Validador do Numerador do Fator R (Aderência ao Anexo III)</span>
            </h2>
            <p className="text-xs text-gray-500">
              Conforme a Regra nº 2 do Plano de Contas, selecione os valores mensais acumulados para testar o enquadramento na alíquota unificada de 6% (Simples Anexo III - Fator R ≥ 28,0%).
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Inputs */}
            <div className="lg:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                1. Premissas de Faturamento & Contas da Folha (R$/mês)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receita Bruta Acumulada 12 Meses (RBT12)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">R$</span>
                    <input
                      type="number"
                      value={simulatedRbt12}
                      onChange={(e) => setSimulatedRbt12(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    [5.2.01.01] Salários CLT Admin & Pátio
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">R$</span>
                    <input
                      type="number"
                      value={simulatedSalarios}
                      onChange={(e) => setSimulatedSalarios(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    [5.2.01.02] Pró-labore Regular dos Sócios
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">R$</span>
                    <input
                      type="number"
                      value={simulatedProLaboreRegular}
                      onChange={(e) => setSimulatedProLaboreRegular(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-amber-900">
                    🔒 [5.2.01.03] Pró-labore Adicional Fator R
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-amber-600 font-mono">R$</span>
                    <input
                      type="number"
                      value={simulatedProLaboreAdicional}
                      onChange={(e) => setSimulatedProLaboreAdicional(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-1.5 bg-amber-50 border border-amber-300 rounded text-xs font-mono font-bold text-amber-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    [2.1.01.06/07] Encargos FGTS / INSS
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">R$</span>
                    <input
                      type="number"
                      value={simulatedFgtsInss}
                      onChange={(e) => setSimulatedFgtsInss(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-800 mb-1">
                    ❌ [5.1.02.01] MO Terceirizada (Excluído do Numerador)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-rose-400 font-mono">R$</span>
                    <input
                      type="number"
                      value={simulatedTerceirizados}
                      onChange={(e) => setSimulatedTerceirizados(Number(e.target.value))}
                      className="w-full pl-9 pr-3 py-1.5 bg-rose-50 border border-rose-200 rounded text-xs font-mono text-rose-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Result Gauge */}
            <div className={`p-6 rounded-xl border flex flex-col justify-between ${
              isAnexo3Ok ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-slate-600">Resultado do Fator R</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isAnexo3Ok ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {isAnexo3Ok ? 'Anexo III (6.0%)' : 'Atenção: Anexo V (15.5%)'}
                  </span>
                </div>

                <div className="text-3xl font-black font-mono my-2 text-slate-900">
                  {calculatedFatorR.toFixed(2)}%
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden my-3">
                  <div
                    className={`h-full transition-all duration-500 ${isAnexo3Ok ? 'bg-emerald-600' : 'bg-rose-600'}`}
                    style={{ width: `${Math.min(100, (calculatedFatorR / 35) * 100)}%` }}
                  ></div>
                </div>

                <div className="text-xs space-y-2 mt-4">
                  <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-600">
                    <span>Folha Mensal Elegível:</span>
                    <strong className="font-mono">R$ {totalFolhaMensal.toLocaleString('pt-BR')}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-600">
                    <span>Folha Anualizada (12m):</span>
                    <strong className="font-mono">R$ {totalFolhaAnual.toLocaleString('pt-BR')}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-600">
                    <span>Meta de Alíquota:</span>
                    <strong className="text-emerald-700">Simples Anexo III (≥ 28,0%)</strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 italic">
                  * Conta 5.1.02.01 (Mão de Obra Terceirizada R$ {simulatedTerceirizados.toLocaleString('pt-BR')}/mês) mantida fora do cálculo conforme normativo do Simples Nacional.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXPORTADOR PARA ERPS */}
      {activeTab === 'export' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#1F3864] flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span>Exportador de Plano de Contas para Sistemas Contábeis & ERPs</span>
            </h2>
            <p className="text-xs text-gray-500">
              Gere os arquivos no leiaute exato exigido pelos principais softwares do mercado nacional para importar a estrutura da 3PL Fitness Hub Itajaí.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => setExportFormat('csv')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                exportFormat === 'csv'
                  ? 'border-[#1F3864] bg-blue-50/50 shadow-xs ring-2 ring-blue-900/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <FileSpreadsheet className="w-6 h-6 text-green-600 mb-2" />
              <h3 className="text-xs font-bold text-slate-900">Planilha Excel / CSV</h3>
              <p className="text-[11px] text-slate-500 mt-1">Formato delimitado por ponto e vírgula com acentuação UTF-8.</p>
            </button>

            <button
              onClick={() => setExportFormat('dominio')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                exportFormat === 'dominio'
                  ? 'border-[#1F3864] bg-blue-50/50 shadow-xs ring-2 ring-blue-900/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <FileText className="w-6 h-6 text-amber-600 mb-2" />
              <h3 className="text-xs font-bold text-slate-900">Domínio Contábil</h3>
              <p className="text-[11px] text-slate-500 mt-1">Leiaute posicional oficial da Thomson Reuters Domínio.</p>
            </button>

            <button
              onClick={() => setExportFormat('questor')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                exportFormat === 'questor'
                  ? 'border-[#1F3864] bg-blue-50/50 shadow-xs ring-2 ring-blue-900/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <FileText className="w-6 h-6 text-purple-600 mb-2" />
              <h3 className="text-xs font-bold text-slate-900">Questor / Conta Azul</h3>
              <p className="text-[11px] text-slate-500 mt-1">Formato de importação via pipe (|) para ERPs em nuvem.</p>
            </button>

            <button
              onClick={() => setExportFormat('json')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                exportFormat === 'json'
                  ? 'border-[#1F3864] bg-blue-50/50 shadow-xs ring-2 ring-blue-900/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Layers className="w-6 h-6 text-blue-600 mb-2" />
              <h3 className="text-xs font-bold text-slate-900">JSON Estruturado</h3>
              <p className="text-[11px] text-slate-500 mt-1">Para integração via API, TypeScript e migração WMS.</p>
            </button>
          </div>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-60">
            <div className="text-slate-400 text-[10px] mb-2 font-sans border-b border-slate-800 pb-1 flex justify-between items-center">
              <span>Pré-visualização do Arquivo de Exportação ({exportFormat.toUpperCase()})</span>
              <span>{chartOfAccounts.length} registros</span>
            </div>
            <pre className="text-[11px] text-emerald-400 leading-tight">
              {exportFormat === 'csv' && `Codigo;Nome;Nivel;Grupo;Natureza;Tipo;Centro_Custo
"1";"ATIVO";1;"ATIVO";"Devedora";"Sintética";""
"1.1.01.01";"Caixa Geral";4;"ATIVO";"Devedora";"Analítica";"CC 001"
"2.1.01.03";"Pró-labore (Adicional Fator R)";4;"PASSIVO";"Credora";"Analítica";"CC 005"
...`}
              {exportFormat === 'dominio' && `=====================================================
SISTEMA DOMÍNIO CONTÁBIL - IMPORTAÇÃO
EMPRESA: 3PL FITNESS HUB ITAJAÍ LTDA
=====================================================
1              | S | D | ATIVO
1.1.01.01      | A | D | Caixa Geral
...`}
              {exportFormat === 'questor' && `QUESTOR_PLANO_CONTAS_v3.5
1|ATIVO|1|1|001
1.1.01.01|Caixa Geral|2|1|CC 001
2.1.01.03|Pró-labore Adicional Fator R|2|2|CC 005
...`}
              {exportFormat === 'json' && `[
  {
    "code": "1",
    "name": "ATIVO",
    "level": 1,
    "group": "ATIVO"
  }, ...
]`}
            </pre>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleExportPlano}
              className="bg-[#1F3864] hover:bg-blue-900 text-white font-bold px-6 py-2.5 rounded-lg text-xs shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Baixar Arquivo Completo ({exportFormat.toUpperCase()})</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL ACCOUNT INSPECTOR */}
      {selectedAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setSelectedAccountModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#1F3864] text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                {selectedAccountModal.code}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  selectedAccountModal.type === 'Sintética' ? 'bg-slate-200 text-slate-800' : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {selectedAccountModal.type}
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                Nível {selectedAccountModal.level}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-3">{selectedAccountModal.name}</h3>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">Grupo do Balanço:</span>
                <strong className="text-slate-900">{selectedAccountModal.group}</strong>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">Natureza do Saldo:</span>
                <strong className={selectedAccountModal.nature === 'Devedora' ? 'text-rose-700' : 'text-blue-700'}>
                  {selectedAccountModal.nature}
                </strong>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">Centro de Custo Padrão:</span>
                <strong>{selectedAccountModal.costCenterId || 'Geral (CC 001)'}</strong>
              </div>

              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-medium">Classificação Fator R:</span>
                {selectedAccountModal.isFatorRNumerator ? (
                  <strong className="text-emerald-700">(+) Integra Numerador Fator R</strong>
                ) : selectedAccountModal.isFatorRExcluded ? (
                  <strong className="text-rose-700">❌ Excluído do Fator R</strong>
                ) : (
                  <span className="text-slate-400">Não Aplicável</span>
                )}
              </div>

              {selectedAccountModal.notes && (
                <div className="pt-1">
                  <span className="text-slate-500 font-medium block mb-1">Observações & Memória de Cálculo:</span>
                  <p className="text-slate-700 italic bg-white p-2.5 rounded border border-slate-200">
                    {selectedAccountModal.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-between items-center">
              <button
                onClick={() => copyToClipboard(selectedAccountModal.code)}
                className="text-xs text-[#1F3864] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCode === selectedAccountModal.code ? 'Copiado!' : 'Copiar Código'}</span>
              </button>

              <button
                onClick={() => setSelectedAccountModal(null)}
                className="bg-[#1F3864] hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
