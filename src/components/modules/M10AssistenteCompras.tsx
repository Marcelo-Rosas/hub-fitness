import React, { useEffect, useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { SupplierQuote, MappedVsImplementedCostItem, SupplierCompany } from '../../types';
import {
  ShoppingBag,
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  Plus,
  Zap,
  TrendingDown,
  Building2,
  Award,
  Calendar,
  ExternalLink,
  Percent,
  ChevronRight,
  Printer,
  Send,
} from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import {
  RFQ_VOLUME_CATALOG,
  RFQ_PAYMENT_CATALOG,
  MATERIAL_CATEGORY_CATALOG,
  STATE_FILTER_CATALOG,
  productsForCategory,
} from '../../data/formCatalogs';
import { formatHubSiteDestination } from '../../core/params';
import {
  comprasCoaOptions,
  formatCoaFilterLabel,
  resolveQuoteAccountCode,
  accountCodeForCategory,
  materialCategoryHint,
} from '../../core/compras/researchFromCoa';
import { ComprasPesquisaPanel } from '../ComprasPesquisaPanel';
import { resolveSupplierContactEmail } from '../../ingest/mapPacks';
import type { ApprovalStatus, IntranetRequestRecord } from '../../types/intranet';

type M10Tab = 'pesquisa' | 'cotacoes' | 'ia' | 'rfq' | 'catalogo' | 'mapeado';

export const M10AssistenteCompras: React.FC = () => {
  const {
    mappedVsImplementedCosts,
    supplierCompanies,
    supplierQuotes,
    applyQuoteToDre,
    addSupplierQuote,
    ingestComprasFromResearch,
    openInspector,
    activeRole,
    pitchMode,
    user,
    hubParams,
  } = usePlanner();

  const hubSite = hubParams.site;
  const hubDestinationLabel = formatHubSiteDestination(hubSite);
  const [activeTab, setActiveTab] = useState<M10Tab>('pesquisa');
  const [selectedStateFilter, setSelectedStateFilter] = useState<'TODOS' | 'SP' | 'PR' | 'SC'>('TODOS');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('TODOS');
  const [quoteSearchQuery, setQuoteSearchQuery] = useState<string>('');
  const [pipelineReq, setPipelineReq] = useState<IntranetRequestRecord | null>(null);
  const [amplifyNote, setAmplifyNote] = useState<string | null>(null);

  // New Quote Modal state
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierState, setNewSupplierState] = useState<'SP' | 'PR' | 'SC'>('SP');
  const [newMaterialCategory, setNewMaterialCategory] = useState<SupplierQuote['materialCategory']>('Filme Stretch');
  const [newProductDesc, setNewProductDesc] = useState<string>('');
  const [newUnitPrice, setNewUnitPrice] = useState<number>(40);
  const [newMonthlyVolume, setNewMonthlyVolume] = useState<number>(100);
  const [newFreightCost, setNewFreightCost] = useState<number>(0);
  const [newNotes, setNewNotes] = useState<string>('');

  // RFQ Generator State
  const [rfqMaterialCategory, setRfqMaterialCategory] =
    useState<SupplierQuote['materialCategory']>('Filme Stretch');
  const [rfqCategory, setRfqCategory] = useState<string>('Filme Stretch 500mm');
  const [rfqVolume, setRfqVolume] = useState<number>(150);
  const [rfqPaymentTerms, setRfqPaymentTerms] = useState<string>('30/60 dias no boleto');
  const [rfqSupplierId, setRfqSupplierId] = useState<string>('');
  const [alcada, setAlcada] = useState<string | null>(null);
  const [rfqCode] = useState(
    () => `RFQ-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`,
  );
  const [isRfqGenerated, setIsRfqGenerated] = useState<boolean>(false);
  const [rfqBusy, setRfqBusy] = useState(false);
  const [rfqMsg, setRfqMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) {
      setAlcada(null);
      return;
    }
    void fetch('/api/intranet/resolve-approver', {
      headers: { 'x-user-email': user.email },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d = json.data;
          setAlcada(`${d.full_name} · ${d.job_title} · ${d.sector_name}`);
        } else {
          setAlcada(null);
        }
      })
      .catch(() => setAlcada(null));
  }, [user?.email]);

  const refreshMyRequests = () => {
    if (!user?.email) return;
    void fetch('/api/intranet/requests?mine=1', {
      headers: { 'x-user-email': user.email },
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !Array.isArray(json.data)) {
          setPipelineReq(null);
          return;
        }
        if (json.data.length === 0) {
          setPipelineReq(null);
          return;
        }
        const latest = json.data[0] as IntranetRequestRecord;
        setPipelineReq(latest);
        if (
          (latest.status === 'REJECTED' || latest.status === 'CHANGES_REQUESTED') &&
          latest.last_decision_reason
        ) {
          setAmplifyNote(latest.last_decision_reason);
        }
      })
      .catch(() => {
        setPipelineReq(null);
      });
  };

  useEffect(() => {
    refreshMyRequests();
    const t = window.setInterval(refreshMyRequests, 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const approvalStatus: ApprovalStatus | 'NONE' = pipelineReq?.status || 'NONE';
  const canSyncDre = approvalStatus === 'APPROVED';

  // Computed summary metrics
  const totalMappedY1 = mappedVsImplementedCosts.reduce((a, b) => a + b.mappedJsonAmountY1, 0);
  const totalImplementedY1 = mappedVsImplementedCosts.reduce((a, b) => a + b.implementedDreAmountY1, 0);
  const totalMonthlySavings = Math.max(0, totalMappedY1 - totalImplementedY1);

  const filteredSuppliers = supplierCompanies.filter((s) => {
    if (selectedStateFilter !== 'TODOS' && s.state !== selectedStateFilter) return false;
    return true;
  });

  const accountFilterOptions = useMemo(() => {
    const fromQuotes = supplierQuotes
      .map((q) => resolveQuoteAccountCode(q))
      .filter((c): c is string => Boolean(c));
    const codes = Array.from(new Set([...comprasCoaOptions().map((o) => o.value), ...fromQuotes]));
    return [
      { value: 'TODOS', label: 'Todas as contas' },
      ...codes.map((code) => ({ value: code, label: formatCoaFilterLabel(code) })),
    ];
  }, [supplierQuotes]);

  const accountGroups = useMemo(() => {
    const codes = Array.from(
      new Set(
        supplierQuotes
          .map((q) => resolveQuoteAccountCode(q))
          .filter((c): c is string => Boolean(c)),
      ),
    ).sort();
    return codes;
  }, [supplierQuotes]);

  const handleCreateQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim() || !newProductDesc.trim()) return;

    const totalCost = newUnitPrice * newMonthlyVolume;
    const totalWithFreight = totalCost + newFreightCost;

    addSupplierQuote({
      supplierId: `sup-custom-${Date.now()}`,
      supplierName: `${newSupplierName} (${newSupplierState})`,
      supplierState: newSupplierState,
      materialCategory: newMaterialCategory,
      accountCode: accountCodeForCategory(newMaterialCategory),
      productDescription: newProductDesc,
      unitPrice: newUnitPrice,
      monthlyVolumeUnit: newMonthlyVolume,
      totalMonthlyCost: totalCost,
      shippingCostMonthly: newFreightCost,
      totalMonthlyWithFreight: totalWithFreight,
      score: 85,
      isRecommendedWinner: false,
      notes: newNotes || 'Cotação inserida manualmente via Assistente de Compras.',
    });

    setIsNewQuoteModalOpen(false);
    setNewSupplierName('');
    setNewProductDesc('');
  };

  const supplierOptions = supplierCompanies.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.state}) · ${s.contactEmail}`,
  }));
  const quoteProductExtras = useMemo(
    () =>
      supplierQuotes
        .filter((q) => q.materialCategory === newMaterialCategory)
        .map((q) => q.productDescription)
        .filter(Boolean),
    [supplierQuotes, newMaterialCategory],
  );
  const productOptions = useMemo(
    () => productsForCategory(newMaterialCategory, [...quoteProductExtras, newProductDesc]),
    [newMaterialCategory, quoteProductExtras, newProductDesc],
  );
  const rfqProductExtras = useMemo(
    () =>
      supplierQuotes
        .filter((q) => q.materialCategory === rfqMaterialCategory)
        .map((q) => q.productDescription)
        .filter(Boolean),
    [supplierQuotes, rfqMaterialCategory],
  );
  const rfqProductOptions = useMemo(
    () => productsForCategory(rfqMaterialCategory, [...rfqProductExtras, rfqCategory]),
    [rfqMaterialCategory, rfqProductExtras, rfqCategory],
  );

  const handleNewCategoryChange = (category: string) => {
    setNewMaterialCategory(category as SupplierQuote['materialCategory']);
    const extras = supplierQuotes
      .filter((q) => q.materialCategory === category)
      .map((q) => q.productDescription);
    const next = productsForCategory(category, extras);
    if (newProductDesc && !next.some((o) => o.value === newProductDesc)) {
      setNewProductDesc('');
    }
  };

  const handleRfqCategoryChange = (category: string) => {
    setRfqMaterialCategory(category as SupplierQuote['materialCategory']);
    const extras = supplierQuotes
      .filter((q) => q.materialCategory === category)
      .map((q) => q.productDescription);
    const next = productsForCategory(category, extras);
    if (rfqCategory && !next.some((o) => o.value === rfqCategory)) {
      setRfqCategory(next[0]?.value || '');
    }
  };

  const selectedSupplier = supplierCompanies.find((s) => s.id === rfqSupplierId);

  /** Comparador: preenche RFQ + SUBMIT alçada (um clique). */
  const sendQuoteForApprovalFromComparador = async (quote: SupplierQuote) => {
    const company = supplierCompanies.find((c) => c.id === quote.supplierId);
    const title =
      quote.productDescription.split(' · ')[0]?.trim() || quote.productDescription;
    setRfqMaterialCategory(quote.materialCategory);
    setRfqCategory(title);
    setRfqVolume(Math.max(1, Number(quote.monthlyVolumeUnit) || 1));
    setRfqSupplierId(quote.supplierId);
    setIsRfqGenerated(true);
    setActiveTab('rfq');

    if (!company) {
      setRfqMsg('Fornecedor não encontrado no cadastro — abra a aba 4 e escolha outro.');
      return;
    }
    const supplierEmail = resolveSupplierContactEmail(company);

    if (!alcada) {
      setRfqMsg(
        'Sem alçada para este login — entre como compras@hubfitness.com.br e envie de novo.',
      );
      return;
    }
    if (pitchMode || activeRole === 'comite') return;

    setRfqBusy(true);
    setRfqMsg(null);
    try {
      const res = await fetch('/api/intranet/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' },
        body: JSON.stringify({
          title: rfqCode,
          supplier_name: company.name,
          supplier_email: supplierEmail,
          payload: {
            category: quote.materialCategory,
            item: title,
            volume: `${Math.max(1, Number(quote.monthlyVolumeUnit) || 1)} un / mês`,
            state: hubSite.uf,
            state_label: hubDestinationLabel,
            warehouse_code: hubSite.warehouseCode,
            account_code: resolveQuoteAccountCode(quote),
            payment: rfqPaymentTerms,
            supplier_id: company.id,
            unit_price: quote.unitPrice,
            freight_monthly: quote.shippingCostMonthly,
            landed_monthly: quote.totalMonthlyWithFreight,
            lead_time_days:
              quote.deliveryLeadTimeDays && quote.deliveryLeadTimeDays > 0
                ? quote.deliveryLeadTimeDays
                : company.deliveryLeadTimeDays && company.deliveryLeadTimeDays > 0
                  ? company.deliveryLeadTimeDays
                  : null,
            score: quote.score,
            supplier_state: quote.supplierState,
            product_description: quote.productDescription,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao enviar');
      setPipelineReq(json.data as IntranetRequestRecord);
      setRfqMsg(
        `Enviado ${json.data.code}. Alçada: ${json.data.assigned_employee_name || alcada}. O e-mail ao fornecedor só dispara após a aprovação.`,
      );
      refreshMyRequests();
    } catch (err) {
      setRfqMsg(err instanceof Error ? err.message : 'Falha ao enviar para aprovação');
    } finally {
      setRfqBusy(false);
    }
  };

  const handleSendForApproval = async () => {
    if (!selectedSupplier) {
      setRfqMsg('Escolha o fornecedor na lista.');
      return;
    }
    const supplierEmail = resolveSupplierContactEmail(selectedSupplier);
    setIsRfqGenerated(true);
    setRfqBusy(true);
    setRfqMsg(null);
    try {
      const res = await fetch('/api/intranet/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' },
        body: JSON.stringify({
          title: rfqCode,
          supplier_name: selectedSupplier.name,
          supplier_email: supplierEmail,
          payload: {
            category: rfqMaterialCategory,
            item: rfqCategory,
            volume: `${rfqVolume} un / mês`,
            state: hubSite.uf,
            state_label: hubDestinationLabel,
            warehouse_code: hubSite.warehouseCode,
            warehouse_name: hubSite.warehouseName,
            city: hubSite.city,
            municipality: hubSite.municipality,
            payment: rfqPaymentTerms,
            supplier_id: selectedSupplier.id,
            unit_price: null,
            freight_monthly: null,
            landed_monthly: null,
            lead_time_days:
              selectedSupplier.deliveryLeadTimeDays && selectedSupplier.deliveryLeadTimeDays > 0
                ? selectedSupplier.deliveryLeadTimeDays
                : null,
            supplier_state: selectedSupplier.state,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao enviar');
      setPipelineReq(json.data as IntranetRequestRecord);
      setRfqMsg(
        `Enviado ${json.data.code}. Alçada: ${json.data.assigned_employee_name || alcada || 'resolvida na árvore'}. O e-mail ao fornecedor só dispara após a aprovação.`,
      );
      refreshMyRequests();
    } catch (err) {
      setRfqMsg(err instanceof Error ? err.message : 'Falha ao enviar para aprovação');
    } finally {
      setRfqBusy(false);
    }
  };

  return (
    <div className="space-[#1a2b4c] space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-linear-to-r from-[#1F3864] via-[#2a487c] to-[#142646] rounded-xl p-6 text-white shadow-md border border-[#2b4b80]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-[#D9E1F2] text-[#1F3864] text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                HUB-FITNESS Procurement Assistant
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Eixo SP · PR · SC
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Assistente de Compras & Avaliação de Fornecedores
            </h1>
            <p className="text-sm text-blue-100 max-w-3xl">
              Mapeamento de custos variáveis vs. DRE Granular, benchmarking real com fornecedores regionais (SP, PR e SC) e sincronização automática de cotações vencedoras no Plano de Negócios v3.5.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsNewQuoteModalOpen(true)}
              disabled={pitchMode || activeRole === 'comite' || activeRole === 'comercial'}
              className="bg-[#2E5B9A] hover:bg-[#386bb4] text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition shadow-sm flex items-center gap-2 border border-blue-400/30 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Nova Cotação Custom
            </button>
            <button
              onClick={() => setActiveTab('rfq')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition shadow-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Gerar RFQ / Pedido
            </button>
          </div>
        </div>

        {/* TOP SUMMARY KPI METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-blue-400/20">
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <div className="text-xs text-blue-200 uppercase font-semibold">Custos Mapeados (Modelo Base)</div>
            <div className="text-xl font-bold text-white mt-1">
              R$ {totalMappedY1.toLocaleString('pt-BR')}<span className="text-xs text-blue-200 font-normal"> /mês</span>
            </div>
            <div className="text-xs text-blue-200 mt-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Verba global inicial no JSON
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <div className="text-xs text-blue-200 uppercase font-semibold">Custo DRE Otimizado (Cotações)</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">
              R$ {totalImplementedY1.toLocaleString('pt-BR')}<span className="text-xs text-emerald-200 font-normal"> /mês</span>
            </div>
            <div className="text-xs text-emerald-200 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ativo na DRE Granular
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <div className="text-xs text-blue-200 uppercase font-semibold">Economia Mensal Estimada</div>
            <div className="text-xl font-bold text-amber-300 mt-1 flex items-center gap-1">
              <TrendingDown className="w-5 h-5 text-amber-400" />
              R$ {totalMonthlySavings.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-amber-200 mt-1">
              Redução de {((totalMonthlySavings / (totalMappedY1 || 1)) * 100).toFixed(1)}% via compras regionalizadas
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/10">
            <div className="text-xs text-blue-200 uppercase font-semibold">Fornecedores Auditados</div>
            <div className="text-xl font-bold text-white mt-1">
              {supplierCompanies.length} Empresas <span className="text-xs text-blue-200 font-normal">(SP/PR/SC)</span>
            </div>
            <div className="text-xs text-blue-200 mt-1 flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-300" /> 100% com NFe & Certificação
            </div>
          </div>
        </div>
      </div>

      {/* NAV — fluxo compras: Pesquisa → Comparador → Tributária → Aprovação/RFQ */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 gap-2 overflow-x-auto shadow-sm">
        <button
          onClick={() => setActiveTab('pesquisa')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'pesquisa'
              ? 'border-[#1F3864] text-[#1F3864]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Search className="w-4 h-4 text-emerald-600" />
          1 · Pesquisa
        </button>

        <button
          onClick={() => setActiveTab('cotacoes')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'cotacoes'
              ? 'border-[#1F3864] text-[#1F3864]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Award className="w-4 h-4" />
          2 · Comparador
        </button>

        <button
          onClick={() => setActiveTab('ia')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'ia'
              ? 'border-[#1F3864] text-[#1F3864]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-600" />
          3 · Avaliação Tributária
        </button>

        <button
          onClick={() => setActiveTab('rfq')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'rfq'
              ? 'border-[#1F3864] text-[#1F3864]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Send className="w-4 h-4" />
          4 · Aprovação · RFQ & Pedidos
        </button>

        <button
          onClick={() => setActiveTab('catalogo')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'catalogo'
              ? 'border-[#1F3864] text-[#1F3864]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Catálogo ({supplierCompanies.length})
        </button>

        <button
          onClick={() => setActiveTab('mapeado')}
          className={`pb-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'mapeado'
              ? 'border-[#1F3864] text-[#1F3864]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Mapeado vs DRE
        </button>
      </div>

      {/* Pipeline badge */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-xs shadow-sm">
        <span className="font-bold text-slate-700 uppercase tracking-wide">Pipeline alçada</span>
        {!pipelineReq && (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">Sem RFQ enviada</span>
        )}
        {pipelineReq?.status === 'IN_REVIEW' && (
          <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-200">
            Em aprovação · {pipelineReq.code}
          </span>
        )}
        {pipelineReq?.status === 'APPROVED' && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado · Sync DRE + catálogo liberados
          </span>
        )}
        {(pipelineReq?.status === 'REJECTED' || pipelineReq?.status === 'CHANGES_REQUESTED') && (
          <>
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold border border-red-200 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {pipelineReq.status === 'REJECTED' ? 'Reprovado' : 'Correção pedida'} · {pipelineReq.code}
            </span>
            <button
              type="button"
              onClick={() => {
                if (pipelineReq.last_decision_reason) setAmplifyNote(pipelineReq.last_decision_reason);
                setActiveTab('pesquisa');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold cursor-pointer"
            >
              Ampliar pesquisa com observação
            </button>
          </>
        )}
        <button
          type="button"
          onClick={refreshMyRequests}
          className="ml-auto text-slate-500 hover:text-slate-800 underline cursor-pointer"
        >
          Atualizar status
        </button>
      </div>

      {/* TAB CONTENT: PESQUISA (CoA → prompt → ingestão) */}
      {activeTab === 'pesquisa' && (
        <ComprasPesquisaPanel
          disabled={pitchMode || activeRole === 'comite' || activeRole === 'comercial'}
          amplifyNote={amplifyNote}
          onClearAmplify={() => setAmplifyNote(null)}
          onGoComparador={(accountCode) => {
            setSelectedAccountFilter(accountCode);
            setActiveTab('cotacoes');
          }}
          onApply={(parsed) => {
            const code =
              parsed.compras?.quotes.find((q) => q.accountCode)?.accountCode ||
              parsed.compras?.quotes[0]?.accountCode;
            ingestComprasFromResearch(
              parsed,
              code ? { replaceAccountCode: code } : undefined,
            );
          }}
        />
      )}

      {/* TAB CONTENT: COMPARADOR DE COTAÇÕES */}
      {activeTab === 'cotacoes' && (
        <div className="space-y-6">
          {/* CATEGORY SELECTOR & FILTER */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-55">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Conta do Plano:</span>
              <div className="flex-1 min-w-50">
                <SearchableSelect
                  value={selectedAccountFilter}
                  options={accountFilterOptions}
                  onChange={setSelectedAccountFilter}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-50">
              <span className="text-xs font-semibold text-gray-500 uppercase">Estado:</span>
              <div className="flex-1 min-w-45">
                <SearchableSelect
                  value={selectedStateFilter}
                  options={STATE_FILTER_CATALOG}
                  onChange={(v) => setSelectedStateFilter(v as typeof selectedStateFilter)}
                  required
                />
              </div>
            </div>
          </div>

          {/* RENDER QUOTES GROUPED BY CATEGORY */}
          {(() => {
            const visibleAccounts = accountGroups.filter(
              (code) => selectedAccountFilter === 'TODOS' || selectedAccountFilter === code,
            );
            const anyCards = visibleAccounts.some((code) =>
              supplierQuotes.some((q) => {
                if (resolveQuoteAccountCode(q) !== code) return false;
                if (selectedStateFilter !== 'TODOS' && q.supplierState !== selectedStateFilter) {
                  return false;
                }
                return true;
              }),
            );

            if (!anyCards) {
              return (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-800">
                    Nenhuma cotação em{' '}
                    {selectedAccountFilter === 'TODOS'
                      ? 'todas as contas'
                      : formatCoaFilterLabel(selectedAccountFilter)}
                    {selectedStateFilter !== 'TODOS' ? ` · UF ${selectedStateFilter}` : ''}.
                  </p>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto">
                    Volte à aba 1 · Pesquisa, execute a pesquisa da conta do Plano e aguarde o ingest — o Comparador
                    lista o resultado aqui.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('pesquisa')}
                      className="px-3 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Ir à Pesquisa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountFilter('TODOS');
                        setSelectedStateFilter('TODOS');
                      }}
                      className="px-3 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
              );
            }

            return visibleAccounts.map((accountCode) => {
              const quotesForAccount = supplierQuotes.filter((q) => {
                if (resolveQuoteAccountCode(q) !== accountCode) return false;
                if (selectedStateFilter !== 'TODOS' && q.supplierState !== selectedStateFilter) {
                  return false;
                }
                return true;
              });

              if (quotesForAccount.length === 0) return null;

              return (
                <div key={accountCode} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-[#F1F5F9] px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Matriz de Cotação: {formatCoaFilterLabel(accountCode)}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Comparativo direto de fornecedores no eixo regional SP · PR · SC ·{' '}
                        {materialCategoryHint(accountCode)}
                      </p>
                    </div>

                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200">
                      {quotesForAccount.length} Fornecedores Cotados
                    </span>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {quotesForAccount.map((quote) => {
                        const isWinner = quote.isRecommendedWinner;
                        const company = supplierCompanies.find((c) => c.id === quote.supplierId);
                        const leadDays =
                          quote.deliveryLeadTimeDays && quote.deliveryLeadTimeDays > 0
                            ? quote.deliveryLeadTimeDays
                            : company?.deliveryLeadTimeDays && company.deliveryLeadTimeDays > 0
                              ? company.deliveryLeadTimeDays
                              : null;
                        const productTitle =
                          quote.productDescription.split(' · ')[0]?.trim() ||
                          quote.productDescription;
                        const productSpec = quote.productDescription.includes(' · ')
                          ? quote.productDescription.split(' · ').slice(1).join(' · ')
                          : '';

                        return (
                          <div
                            key={quote.id}
                            className={`rounded-xl border p-5 transition flex flex-col justify-between relative ${
                              isWinner
                                ? 'border-emerald-500 bg-emerald-50/40 shadow-md ring-2 ring-emerald-400/50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            {isWinner && (
                              <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1 uppercase tracking-wider">
                                <Award className="w-3.5 h-3.5" /> Recomendado Vencedor
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                                    quote.supplierState === 'SP'
                                      ? 'bg-blue-100 text-blue-800'
                                      : quote.supplierState === 'PR'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {quote.supplierState}
                                </span>
                                <span className="text-xs text-gray-500 font-semibold">
                                  Score: <strong className="text-gray-900">{quote.score}/100</strong>
                                </span>
                              </div>

                              <h4 className="font-bold text-gray-900 text-base leading-snug">
                                {productTitle}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">{quote.supplierName}</p>
                              {productSpec ? (
                                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                                  {productSpec}
                                </p>
                              ) : null}

                              <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5 text-xs text-gray-700">
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 shrink-0">Preço Unitário:</span>
                                  <span className="font-semibold text-gray-900 text-right">
                                    R$ {quote.unitPrice.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 shrink-0">
                                    Volume Mensal Estimado:
                                  </span>
                                  <span className="font-semibold text-gray-900 text-right">
                                    {quote.monthlyVolumeUnit} un / mês
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-snug">
                                  Sem dados históricos de compras
                                </p>
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 shrink-0">
                                    Frete Mensal Estimado:
                                  </span>
                                  <span className="font-semibold text-gray-900 text-right">
                                    {quote.shippingCostMonthly === 0 ? (
                                      <span className="text-emerald-600 font-bold">
                                        R$ 0,00 (CIF Inclusos)
                                      </span>
                                    ) : (
                                      `R$ ${quote.shippingCostMonthly.toFixed(2)} (FOB)`
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-gray-500 shrink-0">Prazo de Entrega:</span>
                                  <span className="font-semibold text-gray-900 text-right">
                                    {leadDays != null ? `${leadDays} dia(s)` : 'Não informado'}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="text-[11px] text-gray-500 font-medium uppercase">
                                  Custo Total Mensal (Insumo + Frete)
                                </div>
                                <div className="text-xl font-bold text-[#1F3864] mt-0.5">
                                  R${' '}
                                  {quote.totalMonthlyWithFreight.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                  <span className="text-xs font-normal text-gray-500"> /mês</span>
                                </div>
                              </div>

                              {quote.notes?.trim() ? (
                                <p className="text-[11px] text-gray-500 italic mt-3 bg-white p-2.5 rounded border border-gray-100">
                                  &quot;{quote.notes}&quot;
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-5 pt-3 border-t border-gray-100 space-y-2">
                              {!canSyncDre && approvalStatus !== 'IN_REVIEW' && (
                                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                                  Envie a RFQ para a alçada. Sync DRE libera só após{' '}
                                  <strong>aprovação</strong> (aba 4 · motor intranet).
                                </p>
                              )}
                              {approvalStatus === 'IN_REVIEW' && (
                                <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 rounded px-2 py-1.5">
                                  RFQ {pipelineReq?.code} em aprovação — alçada:{' '}
                                  {pipelineReq?.assigned_employee_name || alcada || '—'}.
                                </p>
                              )}
                              {canSyncDre ? (
                                <button
                                  type="button"
                                  onClick={() => applyQuoteToDre(quote.id)}
                                  disabled={
                                    pitchMode ||
                                    activeRole === 'comite' ||
                                    activeRole === 'comercial'
                                  }
                                  className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                                    isWinner
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      : 'bg-[#1F3864] hover:bg-[#2b4b80] text-white'
                                  } disabled:opacity-50`}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  {isWinner
                                    ? 'Ativo na DRE Granular'
                                    : 'Sincronizar no DRE Granular'}
                                </button>
                              ) : approvalStatus === 'IN_REVIEW' ? (
                                <button
                                  type="button"
                                  disabled
                                  className="w-full py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm bg-slate-200 text-slate-600 opacity-80 cursor-not-allowed"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Aguardando aprovação
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void sendQuoteForApprovalFromComparador(quote)}
                                  disabled={
                                    rfqBusy ||
                                    pitchMode ||
                                    activeRole === 'comite' ||
                                    activeRole === 'comercial'
                                  }
                                  className="w-full py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                                >
                                  <Send className="w-4 h-4" />
                                  {rfqBusy ? 'Enviando…' : 'Enviar para aprovação'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* TAB CONTENT 2: TABELA MAPEADO VS IMPLEMENTADO */}
      {activeTab === 'mapeado' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-[#F8FAFC]">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#1F3864]" />
              Tabela de Custos Variáveis: Mapeado no JSON vs. Implementado na DRE
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Verificação detalhada de lacunas, preços unitários e status de otimização dos custos operacionais no HUB-FITNESS.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-800">
              <thead className="bg-[#1F3864] text-white font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Item de Custo Variável</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Mapeado JSON (Ano 1)</th>
                  <th className="py-3 px-4 text-right">Ativo DRE Granular</th>
                  <th className="py-3 px-4">Unidade de Medida</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Lacuna / Observação</th>
                  <th className="py-3 px-4">Ação Recomendada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mappedVsImplementedCosts.map((item) => {
                  const isOptimized = item.status === 'otimizado';
                  const diff = item.mappedJsonAmountY1 - item.implementedDreAmountY1;

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-gray-900 max-w-xs">
                        {item.itemName}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        {item.category}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-700">
                        R$ {item.mappedJsonAmountY1.toLocaleString('pt-BR')}/mês
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#1F3864]">
                        R$ {item.implementedDreAmountY1.toLocaleString('pt-BR')}/mês
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {item.unitOfMeasure}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.status === 'otimizado' && (
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Otimizado
                          </span>
                        )}
                        {item.status === 'completo' && (
                          <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1 border border-blue-300">
                            <CheckCircle2 className="w-3 h-3" /> Mapeado
                          </span>
                        )}
                        {item.status === 'parcial' && (
                          <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1 border border-amber-300">
                            <AlertCircle className="w-3 h-3" /> Parcial
                          </span>
                        )}
                        {item.status === 'pendente_cotacao' && (
                          <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1 border border-purple-300">
                            <Search className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 max-w-xs text-[11px] leading-relaxed">
                        {item.gapDescription}
                      </td>
                      <td className="py-3.5 px-4 text-blue-900 font-medium max-w-xs text-[11px] leading-relaxed">
                        {item.recommendedAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: CATÁLOGO DE FORNECEDORES REGIONAIS (SP/PR/SC) */}
      {activeTab === 'catalogo' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Catálogo de Empresas Fornecedoras no Eixo SP · PR · SC
              </h3>
              <p className="text-xs text-gray-500">
                Endereço, tempo de entrega, benefícios fiscais de ICMS e condições comerciais de fornecedores homologados.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Filtrar Estado:</span>
              <div className="flex gap-1">
                {(['TODOS', 'SP', 'PR', 'SC'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStateFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedStateFilter === st
                        ? 'bg-[#1F3864] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                      sup.state === 'SP'
                        ? 'bg-blue-100 text-blue-800'
                        : sup.state === 'PR'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {sup.state} · {sup.city}
                    </span>
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                      ★ {sup.rating.toFixed(1)}
                    </span>
                  </div>

                  <h4 className="font-bold text-gray-900 text-base">{sup.name}</h4>
                  <p className="text-xs text-blue-900 font-semibold mt-1">{sup.specialty}</p>

                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Prazo de Entrega:</span>
                      <strong className="text-gray-900">{sup.deliveryLeadTimeDays} dias úteis</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tipo de Frete:</span>
                      <strong className={sup.freightType === 'CIF' ? 'text-emerald-600' : 'text-gray-900'}>
                        {sup.freightType} ({sup.freightType === 'CIF' ? 'Incluso' : 'A Combinar'})
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Condições de Pagamento:</span>
                      <strong className="text-gray-900">{sup.paymentTerms}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Alíquota de ICMS:</span>
                      <strong className="text-gray-900">{sup.icmsTaxRate}%</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 bg-gray-50 -mx-5 -mb-5 p-4 rounded-b-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-gray-700">
                    <span>Telefone:</span>
                    <span className="font-medium">{sup.contactPhone}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-700 truncate">
                    <span>E-mail:</span>
                    <span className="font-medium text-blue-700 truncate ml-2">{sup.contactEmail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: GERADOR DE RFQ / PEDIDO DE COMPRA */}
      {activeTab === 'rfq' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Gerador de Solicitação de Cotação (RFQ) · envio à alçada intranet
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Passo 4 do fluxo: gera o documento e envia SUBMIT ao motor (COM → FIN → DIR). Aprovado libera Sync DRE no Comparador.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Categoria do Insumo:</label>
                <SearchableSelect
                  value={rfqMaterialCategory}
                  options={MATERIAL_CATEGORY_CATALOG}
                  onChange={handleRfqCategoryChange}
                  required
                  placeholder="Filtrar categoria…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Descrição do Produto:</label>
                <SearchableSelect
                  value={rfqCategory}
                  options={rfqProductOptions}
                  onChange={setRfqCategory}
                  allowCustom
                  required
                  placeholder="Filtrado pela categoria…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Volume Mensal Requerido:</label>
                <SearchableSelect
                  value={String(rfqVolume)}
                  options={RFQ_VOLUME_CATALOG}
                  onChange={(v) => setRfqVolume(Number(v) || 0)}
                  allowCustom
                  required
                  placeholder="Filtrar volume…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Destino da entrega (hubParams.site):
                </label>
                <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {hubDestinationLabel}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Metadado do projeto — não é campo de formulário. Origem do fornecedor = Comparador (eixo SP · PR · SC).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Condições de Pagamento Alvo:</label>
                <SearchableSelect
                  value={rfqPaymentTerms}
                  options={RFQ_PAYMENT_CATALOG}
                  onChange={setRfqPaymentTerms}
                  allowCustom
                  required
                  placeholder="Filtrar condição…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Fornecedor escolhido:</label>
                <SearchableSelect
                  value={rfqSupplierId}
                  options={supplierOptions}
                  onChange={setRfqSupplierId}
                  required
                  placeholder="Filtrar fornecedor e e-mail…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Alçada resolvida:</label>
                <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {alcada || 'Sem alçada para este login — entre como compras@hubfitness.com.br'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRfqGenerated(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Gerar Documento RFQ Oficial
              </button>

              <button
                type="button"
                disabled={rfqBusy || pitchMode || activeRole === 'comite' || !alcada}
                onClick={() => void handleSendForApproval()}
                className="w-full bg-[#1F3864] hover:bg-[#2b4b80] text-white font-bold py-2.5 px-4 rounded-lg text-sm transition shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {rfqBusy ? 'Enviando…' : 'Enviar para aprovação'}
              </button>
              {rfqMsg ? (
                <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                  {rfqMsg}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  O decisor não se escolhe: a árvore aponta o aprovador. Four-eyes: o autor não aprova o próprio pedido.
                </p>
              )}
            </div>

            {/* PREVIEW OF RFQ */}
            <div className="bg-[#1E293B] text-slate-100 p-5 rounded-xl border border-slate-700 font-mono text-xs space-y-3 relative overflow-hidden">
              <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                  Documento RFQ · HUB-FITNESS
                </span>
                <span className="text-slate-400 text-[11px]">{new Date().toLocaleDateString('pt-BR')}</span>
              </div>

              <div className="space-y-1.5 text-slate-300">
                <p><strong>SOLICITANTE:</strong> HUB-FITNESS 3PL LOGISTICS S.A.</p>
                <p><strong>REQUISIÇÃO DE COMPRA:</strong> #{rfqCode.replace('RFQ-', '')}</p>
                <p>
                  <strong>DESTINO:</strong> {hubDestinationLabel}
                </p>
                <p><strong>CATEGORIA:</strong> {rfqMaterialCategory}</p>
                <p><strong>ITEM:</strong> {rfqCategory}</p>
                <p><strong>VOLUME ESTIMADO:</strong> {rfqVolume} unidades / mês</p>
                <p>
                  <strong>CONDIÇÃO FISCAL:</strong> Emissão NFe com ICMS até {hubSite.uf}
                  (interestadual tipicamente 12% SP/PR → {hubSite.uf}; intracestadual conforme regra vigente)
                </p>
                <p><strong>PRAZO SOLICITADO:</strong> Entrega em até 5 dias úteis</p>
                <p><strong>PAGAMENTO:</strong> {rfqPaymentTerms}</p>
              </div>

              <div className="pt-3 border-t border-slate-700 text-[11px] text-slate-400">
                Fornecedor: <strong>{selectedSupplier?.name || '—'}</strong>
                {selectedSupplier ? ` · ${selectedSupplier.contactEmail}` : ''}
                <br />
                Favor enviar propostas comerciais para: <strong>compras@hubfitness3pl.com.br</strong>
              </div>

              {isRfqGenerated && (
                <div className="mt-4 pt-3 flex justify-end gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 font-sans font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: IA AVALIADOR TRIBUTÁRIO & FRETES */}
      {activeTab === 'ia' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-900">
              Avaliador Tributário & Logístico Gemini (Eixo SP - PR - SC)
            </h3>
          </div>
          <p className="text-xs text-gray-600">
            A inteligência artificial analisa incentivos de ICMS interestadual, rotas do corredor logístico (BR-116/BR-376) e impacto do frete CIF/FOB nas cotações de materiais do HUB-FITNESS.
          </p>

          <div className="bg-purple-50 rounded-xl p-5 border border-purple-200 text-purple-950 space-y-3 text-xs leading-relaxed">
            <div className="font-bold text-purple-900 flex items-center gap-2 text-sm">
              <Award className="w-4 h-4 text-purple-700" />
              Parecer Técnico de Suprimentos (SP · PR · SC):
            </div>
            <p>
              • <strong>Paletes PBR HT de Madeira:</strong> A compra no Paraná (Ecopack PR - R$ 52,00) reduz o custo unitário em 10,3% em relação a fornecedores de SP (R$ 58,00), aproveitando a menor alíquota de ICMS interestadual (12%) e proximidade do polo florestal de Curitiba/Ponta Grossa.
            </p>
            <p>
              • <strong>Filme Stretch Manual/Automático:</strong> Destino = Galpão A (Itajaí/Navegantes · SC). O CIF gratuito da MBB/Polycamp (Sumaré/SP · R$ 42,50) vale só para entregas em SP e <em>não se aplica</em> ao hub. Landed cost no corredor BR-376: Scheffer/Bela Máquina (PR · R$ 39,90 + FOB R$ 450 ≈ R$ 6.036/mês) ou IW8/Polymer (Brusque/SC · R$ 41,00 + frete local R$ 200 ≈ R$ 6.350/mês, lead time 3 dias). ICMS interestadual 12% (PR/SC) vs 18% (SP).
            </p>
            <p>
              • <strong>Locação de Empilhadeiras Elétricas:</strong> A cotação da Transpotech STILL (PR/SC - R$ 2.175,00/un) gera uma economia acumulada de R$ 10.800 em 24 meses em comparação às locadoras paulistas, mantendo atendimento técnico remoto em até 4 horas com bateria de Lítio.
            </p>
          </div>
        </div>
      )}

      {/* MODAL: NOVA COTAÇÃO CUSTOM */}
      {isNewQuoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" /> Cadastrar Cotação de Fornecedor Custom
              </h3>
              <button
                onClick={() => setIsNewQuoteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateQuoteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nome do Fornecedor:</label>
                <SearchableSelect
                  value={newSupplierName}
                  options={supplierCompanies.map((s) => ({ value: s.name, label: `${s.name} (${s.state})` }))}
                  onChange={setNewSupplierName}
                  allowCustom
                  required
                  placeholder="Filtrar ou digitar fornecedor…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Estado (SP/PR/SC):</label>
                  <SearchableSelect
                    value={newSupplierState}
                    options={[
                      { value: 'SP', label: 'São Paulo (SP)' },
                      { value: 'PR', label: 'Paraná (PR)' },
                      { value: 'SC', label: 'Santa Catarina (SC)' },
                    ]}
                    onChange={(v) => setNewSupplierState(v as typeof newSupplierState)}
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Categoria do Insumo:</label>
                  <SearchableSelect
                    value={newMaterialCategory}
                    options={MATERIAL_CATEGORY_CATALOG}
                    onChange={handleNewCategoryChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Descrição do Produto / Especificação:</label>
                <SearchableSelect
                  value={newProductDesc}
                  options={productOptions}
                  onChange={setNewProductDesc}
                  allowCustom
                  required
                  placeholder="Filtrado pela categoria…"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Preço Un. (R$):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2.5 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Qtd Mensal:</label>
                  <input
                    type="number"
                    value={newMonthlyVolume}
                    onChange={(e) => setNewMonthlyVolume(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2.5 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Frete Mensal (R$):</label>
                  <input
                    type="number"
                    value={newFreightCost}
                    onChange={(e) => setNewFreightCost(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-2.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Observações / Prazos:</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs"
                  placeholder="Condições comerciais, frete CIF/FOB, etc."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewQuoteModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1F3864] hover:bg-[#2b4b80] text-white rounded font-bold text-xs"
                >
                  Salvar Cotação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
