import React, { useMemo, useState } from 'react';
import {
  Globe,
  ShieldCheck,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Key,
  Layers,
  Download,
  Building2,
  BookOpen,
  Info,
  Edit2,
  Trash2,
  Paperclip,
  FolderOpen,
  Settings2,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import type {
  ComexFieldDef,
  ComexProcessRecord,
  PucomexAuthSession,
  PucomexPortalStatus,
} from '../../types/comex';
import { COMEX_PORTS_DATA, PORTO_TABLE_METADATA } from '../../data/comexPortsData';
import { COMEX_ATIT_CITIES_DATA, ATIT_CITY_TABLE_METADATA } from '../../data/comexAtitCitiesData';
import { INITIAL_PUCOMEX_AUTH } from '../../data/comexSeed';
import {
  PUCOMEX_ENDPOINT_CATALOG,
  PUCOMEX_MODULE_LINKS,
} from '../../core/comex/endpoints';
import { PUCOMEX_ENVIRONMENTS, PUCOMEX_ROLE_TYPES } from '../../core/comex/environments';
import { ComexMetaForm } from './ComexMetaForm';
import { ComexFieldDefsPanel } from './ComexFieldDefsPanel';
import { SearchableSelect } from '../ui/SearchableSelect';
import { mergeCatalog, COMEX_NCM_CATALOG } from '../../data/comexCatalogs';
import { PdfDocumentIngestPanel } from '../PdfDocumentIngestPanel';

function payloadText(proc: ComexProcessRecord, key: string): string {
  const value = proc.payload[key];
  if (value == null || value === '') return '—';
  return String(value);
}

function payloadNumber(proc: ComexProcessRecord, key?: string | null): number {
  if (!key) return 0;
  const n = Number(proc.payload[key]);
  return Number.isFinite(n) ? n : 0;
}

const COUNTRY_NAME_MAP: Record<string, string> = {
  BR: 'Brasil (BR)',
  AR: 'Argentina (AR)',
  UY: 'Uruguai (UY)',
  CN: 'China (CN)',
  US: 'Estados Unidos (US)',
  DE: 'Alemanha (DE)',
  NL: 'Holanda (NL)',
  HK: 'Hong Kong (HK)',
  TW: 'Taiwan (TW)',
  CL: 'Chile (CL)',
  PY: 'Paraguai (PY)',
  BO: 'Bolívia (BO)',
  PE: 'Peru (PE)',
};

type SubTab =
  | 'processes'
  | 'ports_table'
  | 'atit_cities_table'
  | 'quick_consult'
  | 'ai_audit'
  | 'api_docs';

export const M18Comex: React.FC = () => {
  const [processes, setProcesses] = useState<ComexProcessRecord[]>([]);
  const [fieldDefs, setFieldDefs] = useState<ComexFieldDef[]>([]);
  const [storeDriver, setStoreDriver] = useState<string>('…');
  const [indexBusy, setIndexBusy] = useState(false);
  const [indexMsg, setIndexMsg] = useState<string | null>(null);
  const [showFieldDefs, setShowFieldDefs] = useState(false);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [pucomexAuth, setPucomexAuth] = useState<PucomexAuthSession>(INITIAL_PUCOMEX_AUTH);
  const [portalStatus, setPortalStatus] = useState<PucomexPortalStatus | null>(null);
  const [endpointCatalog, setEndpointCatalog] = useState(PUCOMEX_ENDPOINT_CATALOG);
  const [authError, setAuthError] = useState<string | null>(null);
  const [consultMode, setConsultMode] = useState<'live' | 'demo' | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('processes');
  const [filterType, setFilterType] = useState<'all' | 'exportacao' | 'importacao'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [portSearchQuery, setPortSearchQuery] = useState('');
  const [portCountryFilter, setPortCountryFilter] = useState('ALL');
  const [portViewMode, setPortViewMode] = useState<'data' | 'metadata'>('data');
  const [portPage, setPortPage] = useState(1);
  const PORT_ITEMS_PER_PAGE = 10;

  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [cityCountryFilter, setCityCountryFilter] = useState('ALL');
  const [cityViewMode, setCityViewMode] = useState<'data' | 'metadata'>('data');

  const [consultType, setConsultType] = useState<'due' | 'duimp' | 'cct'>('duimp');
  const [consultDocNumber, setConsultDocNumber] = useState('');
  const [consultResult, setConsultResult] = useState<Record<string, unknown> | null>(null);
  const [consultLoading, setConsultLoading] = useState(false);
  const [consultError, setConsultError] = useState<string | null>(null);

  const [aiNcmCode, setAiNcmCode] = useState('9506.91.00');
  const [aiDescription, setAiDescription] = useState('Aparelhos de musculação / fitness equipment');
  const [aiOperationType, setAiOperationType] = useState<'exportacao' | 'importacao'>('importacao');
  const [aiFobUsd, setAiFobUsd] = useState('128500');
  const [aiCountry, setAiCountry] = useState('China (CN)');
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ComexProcessRecord | null>(null);
  const [formPayload, setFormPayload] = useState<Record<string, unknown>>({});
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractJson, setExtractJson] = useState<Record<string, unknown> | null>(null);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  const refreshPortalStatus = async () => {
    try {
      const res = await fetch('/api/comex/pucomex/status');
      const json = await res.json();
      if (json.success) {
        setPortalStatus(json.status);
        if (json.session) {
          setPucomexAuth({
            cnpjeCPF: json.session.cnpjeCPF || 'Certificado ICP-Brasil',
            role: json.session.roleType || json.session.role || 'DEPOSIT',
            environment: json.status?.environment || 'validacao',
            tokenPreview: json.session.tokenPreview || '—',
            csrfExpiresAt: json.session.csrfExpiresAt,
            mode: json.session.mode,
            roleType: json.session.roleType,
            authenticatedAt: json.session.authenticatedAt,
          });
        }
      }
    } catch {
      /* offline */
    }
  };

  const loadFieldDefs = async () => {
    const res = await fetch('/api/comex/field-defs?entity=process');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) setFieldDefs(json.data);
  };

  const loadProcesses = async () => {
    const res = await fetch('/api/comex/processes');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) setProcesses(json.data);
    if (json.driver) setStoreDriver(json.driver);
  };

  React.useEffect(() => {
    void refreshPortalStatus();
    void loadFieldDefs().catch(() => undefined);
    void loadProcesses().catch(() => undefined);
    void fetch('/api/comex/pucomex/catalog')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.endpoints)) setEndpointCatalog(json.endpoints);
      })
      .catch(() => undefined);
  }, []);

  const listFields = useMemo(
    () => fieldDefs.filter((f) => f.ui_list).sort((a, b) => a.sort_order - b.sort_order),
    [fieldDefs],
  );
  const formFields = useMemo(
    () => fieldDefs.filter((f) => f.ui_form !== false).sort((a, b) => a.sort_order - b.sort_order),
    [fieldDefs],
  );
  const fobKey = fieldDefs.find((f) => f.kpi === 'fob')?.field_key;
  const cifKey = fieldDefs.find((f) => f.kpi === 'cif')?.field_key;
  const typeKey = fieldDefs.find((f) => f.field_key === 'type')?.field_key || 'type';
  const consultKey = fieldDefs.find((f) => f.consult_key)?.field_key || 'declaration_number';

  const totalFobUsd = useMemo(
    () => processes.reduce((a, p) => a + payloadNumber(p, fobKey), 0),
    [processes, fobKey],
  );
  const totalCifBrl = useMemo(
    () => processes.reduce((a, p) => a + payloadNumber(p, cifKey), 0),
    [processes, cifKey],
  );
  const docsTotal = useMemo(
    () => processes.reduce((a, p) => a + (p.documents?.length || 0), 0),
    [processes],
  );

  const extraCatalogs = useMemo(() => {
    const clients: string[] = [];
    const bls: string[] = [];
    const declarations: string[] = [];
    for (const proc of processes) {
      clients.push(String(proc.payload.client_name || ''));
      bls.push(String(proc.payload.bl_number || ''));
      declarations.push(String(proc.payload.declaration_number || ''));
    }
    return {
      client_name: mergeCatalog([], clients),
      bl_number: mergeCatalog([], bls),
      declaration_number: mergeCatalog([], declarations),
    };
  }, [processes]);

  const integrationModeLabel = portalStatus?.liveModeEnabled
    ? 'LIVE mTLS'
    : portalStatus
      ? 'DEMO (sem PFX)'
      : '…';
  const envLabel =
    PUCOMEX_ENVIRONMENTS[(portalStatus?.environment as keyof typeof PUCOMEX_ENVIRONMENTS) || 'validacao']
      ?.label || portalStatus?.environment || pucomexAuth.environment;

  const filteredProcesses = processes.filter((proc) => {
    const type = String(proc.payload[typeKey] || '');
    const matchesFilter = filterType === 'all' || type === filterType;
    const q = searchQuery.toLowerCase();
    const hay = `${proc.code} ${JSON.stringify(proc.payload)}`.toLowerCase();
    return matchesFilter && (!q || hay.includes(q));
  });

  const handleOpenNewModal = () => {
    setEditingProcess(null);
    setFormPayload({ type: 'importacao' });
    setExtractJson(null);
    setExtractMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proc: ComexProcessRecord) => {
    setEditingProcess(proc);
    setFormPayload({ ...proc.payload });
    setExtractJson(null);
    setExtractMsg(null);
    setIsModalOpen(true);
  };

  const handleExtractFromPdf = async (mode: 'empty' | 'replace') => {
    if (!editingProcess) return;
    setExtractBusy(true);
    setExtractMsg(null);
    try {
      const res = await fetch(`/api/comex/processes/${editingProcess.id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: mode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha na extração');
      setExtractJson(json.json || json.fields);
      const next = { ...(json.payload || formPayload) };
      for (const [key, value] of Object.entries(json.fields || {})) {
        if (value == null || value === '') continue;
        const vacant = next[key] == null || next[key] === '';
        if (mode === 'replace' || vacant) next[key] = value;
      }
      setFormPayload(next);
      if (json.payload) {
        setEditingProcess((prev) => (prev ? { ...prev, payload: json.payload } : prev));
        setProcesses((prev) =>
          prev.map((p) => (p.id === editingProcess.id ? { ...p, payload: json.payload } : p)),
        );
      }
      const src = Array.isArray(json.sources)
        ? json.sources.map((s: { file_name: string }) => s.file_name).join(', ')
        : '';
      setExtractMsg(
        `${Object.keys(json.fields || {}).length} campos via ${json.engine}${src ? ` · ${src}` : ''}`,
      );
    } catch (err: unknown) {
      setExtractMsg(err instanceof Error ? err.message : 'Falha ao ler PDF');
    } finally {
      setExtractBusy(false);
    }
  };

  const handleSaveProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = formFields.filter((f) => f.required && (formPayload[f.field_key] == null || formPayload[f.field_key] === ''));
    if (missing.length) return;
    if (editingProcess) {
      const res = await fetch(`/api/comex/processes/${editingProcess.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: formPayload, code: editingProcess.code }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setProcesses((prev) => prev.map((p) => (p.id === json.data.id ? json.data : p)));
      }
    } else {
      const res = await fetch('/api/comex/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: formPayload }),
      });
      const json = await res.json();
      if (json.success && json.data) setProcesses((prev) => [json.data, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteProcess = async (proc: ComexProcessRecord) => {
    const label = payloadText(proc, 'client_name');
    if (!window.confirm(`Excluir processo ${proc.code}${label !== '—' ? ` (${label})` : ''}?`)) return;
    await fetch(`/api/comex/processes/${proc.id}`, { method: 'DELETE' });
    setProcesses((prev) => prev.filter((p) => p.id !== proc.id));
  };

  const handleIndexDocs = async () => {
    setIndexBusy(true);
    setIndexMsg(null);
    try {
      const res = await fetch('/api/comex/documents/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extract: true }),
      });
      const json = await res.json();
      if (json.success) {
        setIndexMsg(
          `${json.result.documents} PDFs · ${json.result.processes} processos · ${json.result.extracted ?? 0} populados (PDF→JSON)`,
        );
        await loadProcesses();
      } else {
        setIndexMsg(json.error || 'Falha ao indexar');
      }
    } catch (err: unknown) {
      setIndexMsg(err instanceof Error ? err.message : 'Falha de rede');
    } finally {
      setIndexBusy(false);
    }
  };

  const handleConsultProcess = async (proc: ComexProcessRecord) => {
    const declaration = payloadText(proc, consultKey);
    if (declaration === '—') {
      handleOpenEditModal(proc);
      return;
    }
    setConsultType(String(proc.payload[typeKey]) === 'exportacao' ? 'due' : 'duimp');
    setConsultDocNumber(declaration);
    setActiveSubTab('quick_consult');
    setConsultLoading(true);
    setConsultError(null);
    try {
      const res = await fetch(`/api/comex/processes/${proc.id}/consult`, { method: 'POST' });
      const json = await res.json();
      setConsultResult(json);
      setConsultMode(json.mode || null);
      if (!json.success) setConsultError(json.error || `Portal HTTP ${json.httpStatus || '?'}`);
      await loadProcesses();
    } catch (err: unknown) {
      setConsultError(err instanceof Error ? err.message : 'Falha de rede');
    } finally {
      setConsultLoading(false);
    }
  };

  const handleReauthenticate = async () => {
    setAuthLoading(true);
    setAuthSuccessMsg(null);
    setAuthError(null);
    try {
      const res = await fetch('/api/comex/pucomex/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force: false,
          roleType: portalStatus?.roleType || 'DEPOSIT',
        }),
      });
      const data = await res.json();
      if (data.session) {
        setPucomexAuth({
          cnpjeCPF: data.session.cnpjeCPF || 'Certificado ICP-Brasil',
          role: data.session.roleType || data.session.role || 'DEPOSIT',
          environment: data.portalStatus?.environment || data.mode,
          tokenPreview: data.session.tokenPreview || '—',
          csrfExpiresAt: data.session.csrfExpiresAt,
          mode: data.mode,
          roleType: data.session.roleType,
          authenticatedAt: data.session.authenticatedAt,
        });
      }
      if (data.portalStatus) setPortalStatus(data.portalStatus);
      if (data.success) {
        setAuthSuccessMsg(
          data.mode === 'live'
            ? 'Autenticado no Portal Único (Set-Token + X-CSRF-Token). Reutilize o CSRF até expirar (~60 min).'
            : data.error ||
                'Sessão DEMO ativa — configure PUCOMEX_CERT_PFX_PATH + PUCOMEX_CERT_PASSWORD para live.',
        );
      } else {
        setAuthError(data.error || 'Falha na autenticação PUCOMEX');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha de rede');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExecuteConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultDocNumber.trim()) return;
    setConsultLoading(true);
    setConsultError(null);
    setConsultResult(null);

    let endpoint = '/api/comex/due/consult';
    let bodyData: Record<string, string> = { dueNumber: consultDocNumber };
    if (consultType === 'duimp') {
      endpoint = '/api/comex/duimp/consult';
      bodyData = { duimpNumber: consultDocNumber };
    } else if (consultType === 'cct') {
      endpoint = '/api/comex/cct/consult';
      bodyData = { accessKey: consultDocNumber };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      const json = await res.json();
      setConsultMode(json.mode || null);
      if (json.success) setConsultResult(json.data);
      else setConsultError(json.error || 'Erro na consulta Siscomex.');
    } catch (err: unknown) {
      setConsultError(err instanceof Error ? err.message : 'Falha na conexão.');
    } finally {
      setConsultLoading(false);
    }
  };

  const handleExecuteAiAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch('/api/gemini/comex-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ncmCode: aiNcmCode,
          productDescription: aiDescription,
          operationType: aiOperationType,
          fobValueUsd: parseFloat(aiFobUsd) || 50000,
          country: aiCountry,
        }),
      });
      const json = await res.json();
      if (json.success) setAiResult(json.data);
      else setAiError(json.error || 'Erro na auditoria.');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Falha ao conectar.');
    } finally {
      setAiLoading(false);
    }
  };

  const tabActiveClass: Record<string, string> = {
    indigo: 'border-indigo-600 text-indigo-600',
    teal: 'border-teal-600 text-teal-600',
    cyan: 'border-cyan-600 text-cyan-600',
    violet: 'border-violet-600 text-violet-600',
  };

  const tabBtn = (id: SubTab, label: string, icon: React.ReactNode, activeColor = 'indigo') => (
    <button
      type="button"
      onClick={() => setActiveSubTab(id)}
      className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
        activeSubTab === id
          ? tabActiveClass[activeColor] || tabActiveClass.indigo
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <ModuleHeader
        moduleId="M18"
        title="Comex · Portal Único Siscomex"
        subtitle="Integração oficial PUCOMEX (mTLS + JWT/CSRF) — DU-E, DUIMP, CCT, NCM 9506 · ADR-003"
        kpis={[
          { label: 'Processos', value: processes.length, subtext: `${storeDriver} · ${docsTotal} docs`, highlightColor: 'indigo' },
          {
            label: 'FOB Total',
            value: `USD ${totalFobUsd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
            highlightColor: 'emerald',
          },
          {
            label: 'CIF Total',
            value: `R$ ${totalCifBrl.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
            subtext: 'Pitch/CLIA — não Ad Valorem DRE',
            highlightColor: 'blue',
          },
          {
            label: 'Portal',
            value: integrationModeLabel,
            subtext: envLabel,
            highlightColor: portalStatus?.liveModeEnabled ? 'emerald' : 'amber',
          },
        ]}
      />

      {/* PUCOMEX status */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-teal-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <Globe className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 flex-wrap">
                  PUCOMEX Integration
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      portalStatus?.liveModeEnabled
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                    }`}
                  >
                    {integrationModeLabel}
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  Auth oficial:{' '}
                  <span className="font-mono text-teal-300">POST /portal/api/autenticar</span> · Role-Type{' '}
                  <span className="font-mono">{portalStatus?.roleType || 'DEPOSIT'}</span>
                  {portalStatus?.baseUrl ? (
                    <>
                      {' '}
                      · <span className="font-mono text-[10px]">{portalStatus.baseUrl}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-700/60">
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <div className="text-[10px] text-slate-400">CERTIFICADO A1</div>
                  <div className="font-semibold text-slate-200 truncate">
                    {portalStatus?.certConfigured ? pucomexAuth.cnpjeCPF : 'PFX não configurado (.env)'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-700/60">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">ROLE-TYPE</div>
                  <div className="font-semibold text-slate-200">
                    {portalStatus?.roleType || pucomexAuth.role} ·{' '}
                    {PUCOMEX_ROLE_TYPES.find((r) => r.code === (portalStatus?.roleType || 'DEPOSIT'))?.label ||
                      'Depositário'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-700/60">
                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">AMBIENTE</div>
                  <div className="font-semibold text-slate-200">{envLabel}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={handleReauthenticate}
              disabled={authLoading}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-teal-400 ${authLoading ? 'animate-spin' : ''}`} />
              {authLoading ? 'Autenticando...' : 'Autenticar Portal'}
            </button>
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Processo Comex
            </button>
            <button
              type="button"
              onClick={() => void handleIndexDocs()}
              disabled={indexBusy}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderOpen className={`w-4 h-4 text-amber-300 ${indexBusy ? 'animate-pulse' : ''}`} />
              {indexBusy ? 'Indexando e populando…' : 'Indexar D:\\Comex + popular JSON'}
            </button>
          </div>
        </div>
        {authSuccessMsg && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {authSuccessMsg}
          </div>
        )}
        {indexMsg && (
          <div className="mt-4 p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-100 text-xs flex items-center gap-2">
            <Paperclip className="w-4 h-4 shrink-0" />
            {indexMsg}
          </div>
        )}
        {authError && (
          <div className="mt-4 p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-100 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {authError}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            Total de Processos <Globe className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{processes.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {processes.filter((p) => String(p.payload[typeKey]) === 'exportacao').length} Exp ·{' '}
            {processes.filter((p) => String(p.payload[typeKey]) === 'importacao').length} Imp
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            FOB USD <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            USD {totalFobUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            CIF BRL <ArrowDownRight className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">
            R$ {totalCifBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            Status Siscomex <ShieldCheck className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-bold text-teal-600 mt-2">
            {portalStatus?.liveModeEnabled ? 'LIVE' : 'DEMO'}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {portalStatus?.sessionActive ? 'Sessão ativa' : 'Sem sessão — autentique'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-0.5">
          {tabBtn('processes', `Processos (${processes.length})`, <Layers className="w-4 h-4" />)}
          {tabBtn('ports_table', `Portos (${COMEX_PORTS_DATA.length})`, <Globe className="w-4 h-4 text-teal-600" />, 'teal')}
          {tabBtn('atit_cities_table', `ATIT (${COMEX_ATIT_CITIES_DATA.length})`, <Building2 className="w-4 h-4 text-cyan-600" />, 'cyan')}
          {tabBtn('quick_consult', 'Consulta PUCOMEX', <Search className="w-4 h-4" />)}
          {tabBtn('ai_audit', 'Auditoria NCM IA', <Sparkles className="w-4 h-4 text-violet-500" />, 'violet')}
          {tabBtn('api_docs', 'Docs API', <BookOpen className="w-4 h-4" />)}
        </div>
        {activeSubTab === 'processes' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFieldDefs((v) => !v)}
              className="py-1 px-2.5 border border-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Campos
            </button>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="py-1 px-2.5 border border-slate-200 rounded-lg text-xs w-36"
            />
            <SearchableSelect
              value={filterType}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'exportacao', label: 'Exportação' },
                { value: 'importacao', label: 'Importação' },
              ]}
              onChange={(v) => setFilterType((v || 'all') as typeof filterType)}
              placeholder="Filtrar tipo…"
            />
          </div>
        )}
      </div>

      {/* Processes */}
      {activeSubTab === 'processes' && (
        <div className="space-y-4">
          <PdfDocumentIngestPanel
            onPopulated={(proc) => {
              setProcesses((prev) => [proc, ...prev.filter((p) => p.id !== proc.id)]);
            }}
          />
          {showFieldDefs ? (
            <ComexFieldDefsPanel fields={fieldDefs} onReload={loadFieldDefs} />
          ) : null}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  {listFields.map((f) => (
                    <th key={f.id} className="py-3 px-4">
                      {f.label}
                    </th>
                  ))}
                  <th className="py-3 px-4">Docs</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={listFields.length + 3} className="py-8 text-center text-slate-400">
                      Nenhum processo. Envie PDF (BL/DI/PI/Packing List) ou indexe D:\Comex.
                    </td>
                  </tr>
                ) : (
                  filteredProcesses.map((proc) => {
                    const type = String(proc.payload[typeKey] || '');
                    const docs = proc.documents || [];
                    const expanded = expandedProcessId === proc.id;
                    return (
                      <React.Fragment key={proc.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{proc.code}</div>
                        <div className="text-[10px] text-slate-400">{proc.client_slug || 'Client DB local'}</div>
                      </td>
                      {listFields.map((f) => {
                        const raw = payloadText(proc, f.field_key);
                        if (f.field_key === typeKey) {
                          return (
                            <td key={f.id} className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold ${
                                  type === 'exportacao'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {type === 'exportacao' ? (
                                  <ArrowUpRight className="w-3 h-3" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3" />
                                )}
                                {raw}
                              </span>
                            </td>
                          );
                        }
                        if (f.data_type === 'number') {
                          const n = payloadNumber(proc, f.field_key);
                          return (
                            <td key={f.id} className="py-3 px-4 font-bold">
                              {n
                                ? n.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
                                : '—'}
                            </td>
                          );
                        }
                        return (
                          <td key={f.id} className="py-3 px-4">
                            <span className={f.widget === 'text' && f.field_key.includes('ncm') ? 'font-mono bg-slate-100 px-1.5 py-0.5 rounded' : ''}>
                              {raw}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setExpandedProcessId(expanded ? null : proc.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-50 border text-[11px] cursor-pointer"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {docs.length}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Consultar DUIMP/DU-E no Portal"
                            onClick={() => void handleConsultProcess(proc)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => handleOpenEditModal(proc)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            onClick={() => void handleDeleteProcess(proc)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-slate-50/70">
                        <td colSpan={listFields.length + 3} className="px-4 py-3">
                          {docs.length === 0 ? (
                            <p className="text-[11px] text-slate-500">Sem documentos ligados a este BL.</p>
                          ) : (
                            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {docs.map((doc) => (
                                <li key={doc.id}>
                                  <a
                                    href={`/api/comex/documents/${doc.id}/file`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg border bg-white hover:border-teal-300"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                    <span className="uppercase font-bold text-slate-500">{doc.doc_type}</span>
                                    <span className="truncate">{doc.file_name}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ) : null}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* Ports */}
      {activeSubTab === 'ports_table' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Globe className="w-5 h-5 text-teal-600" />
                  Tabela PORTO (subset Siscomex)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Prioridade: Navegantes, Itapoá, Santos + origem CN.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPortViewMode('data')}
                  className={`py-1.5 px-3 rounded-lg cursor-pointer ${portViewMode === 'data' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-600'}`}
                >
                  Dados
                </button>
                <button
                  type="button"
                  onClick={() => setPortViewMode('metadata')}
                  className={`py-1.5 px-3 rounded-lg cursor-pointer ${portViewMode === 'metadata' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-600'}`}
                >
                  Metadados
                </button>
              </div>
            </div>
            {portViewMode === 'data' && (
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-50 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={portSearchQuery}
                    onChange={(e) => {
                      setPortSearchQuery(e.target.value);
                      setPortPage(1);
                    }}
                    placeholder="Código ou descrição..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                {['ALL', 'BR', 'CN', 'US', 'DE', 'NL'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPortCountryFilter(id);
                      setPortPage(1);
                    }}
                    className={`py-1 px-2.5 rounded-full text-xs font-medium cursor-pointer ${
                      portCountryFilter === id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {id === 'ALL' ? 'Todos' : id}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(COMEX_PORTS_DATA, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'tabela_porto_hub_fitness.json';
                    a.click();
                  }}
                  className="py-2 px-3 bg-slate-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> JSON
                </button>
              </div>
            )}
          </div>

          {portViewMode === 'data' &&
            (() => {
              const filtered = COMEX_PORTS_DATA.filter((p) => {
                const q = portSearchQuery.toLowerCase().trim();
                const mq =
                  !q ||
                  p.codigo.toLowerCase().includes(q) ||
                  p.descricao.toLowerCase().includes(q);
                const mc = portCountryFilter === 'ALL' || p.codigo.startsWith(portCountryFilter);
                return mq && mc;
              });
              const totalPages = Math.ceil(filtered.length / PORT_ITEMS_PER_PAGE) || 1;
              const page = Math.min(portPage, totalPages);
              const slice = filtered.slice((page - 1) * PORT_ITEMS_PER_PAGE, page * PORT_ITEMS_PER_PAGE);
              return (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                      <tr>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Descrição</th>
                        <th className="py-3 px-4">Vigência</th>
                        <th className="py-3 px-4">Versão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {slice.map((port) => (
                        <tr key={port.codigo} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {port.codigo}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans font-bold text-slate-900">{port.descricao}</td>
                          <td className="py-3 px-4 text-slate-600">{port.dataInicio}</td>
                          <td className="py-3 px-4">{port.internoVersao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="p-3 bg-slate-50 border-t flex justify-between text-xs">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPortPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 bg-white border rounded disabled:opacity-40 cursor-pointer"
                      >
                        Anterior
                      </button>
                      <span>
                        {page}/{totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPortPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1 bg-white border rounded disabled:opacity-40 cursor-pointer"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          {portViewMode === 'metadata' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                  <tr>
                    <th className="py-2 px-3">Rótulo</th>
                    <th className="py-2 px-3">Campo</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Obrigatório</th>
                    <th className="py-2 px-3">Chave</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {PORTO_TABLE_METADATA.map((col) => (
                    <tr key={col.nome}>
                      <td className="py-2 px-3 font-bold">{col.rotulo}</td>
                      <td className="py-2 px-3 font-mono text-indigo-600">{col.nome}</td>
                      <td className="py-2 px-3">{col.tipo}</td>
                      <td className="py-2 px-3">{col.obrigatorio}</td>
                      <td className="py-2 px-3">{col.chaveDeNegocio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ATIT */}
      {activeSubTab === 'atit_cities_table' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3">
            <div className="flex flex-col md:flex-row justify-between gap-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-600" />
                Cidade ATIT (subset CCT)
              </h3>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCityViewMode('data')}
                  className={`py-1.5 px-3 rounded-lg cursor-pointer ${cityViewMode === 'data' ? 'bg-white text-cyan-700' : ''}`}
                >
                  Dados
                </button>
                <button
                  type="button"
                  onClick={() => setCityViewMode('metadata')}
                  className={`py-1.5 px-3 rounded-lg cursor-pointer ${cityViewMode === 'metadata' ? 'bg-white text-indigo-700' : ''}`}
                >
                  Metadados
                </button>
              </div>
            </div>
            {cityViewMode === 'data' && (
              <div className="flex flex-wrap gap-2">
                <input
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  placeholder="Buscar cidade..."
                  className="px-3 py-2 bg-slate-50 border rounded-lg text-xs flex-1 max-w-md"
                />
                {['ALL', 'BR', 'AR', 'UY', 'PY', 'CL', 'BO', 'PE'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCityCountryFilter(id)}
                    className={`py-1 px-2.5 rounded-full text-xs cursor-pointer ${
                      cityCountryFilter === id ? 'bg-cyan-600 text-white' : 'bg-slate-100'
                    }`}
                  >
                    {id === 'ALL' ? 'Todos' : id}
                  </button>
                ))}
              </div>
            )}
          </div>
          {cityViewMode === 'data' && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] uppercase border-b text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">País</th>
                    <th className="py-3 px-4">Subdivisão</th>
                    <th className="py-3 px-4">Cidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {COMEX_ATIT_CITIES_DATA.filter((c) => {
                    const q = citySearchQuery.toLowerCase();
                    const mq =
                      !q ||
                      c.codigo.toLowerCase().includes(q) ||
                      c.descricao.toLowerCase().includes(q);
                    const mc = cityCountryFilter === 'ALL' || c.siglaIso2Pais === cityCountryFilter;
                    return mq && mc;
                  }).map((city) => (
                    <tr key={city.codigo} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className="bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded border border-cyan-200 font-bold">
                          {city.codigo}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        {city.siglaIso2Pais} · {COUNTRY_NAME_MAP[city.siglaIso2Pais] || city.siglaIso2Pais}
                      </td>
                      <td className="py-3 px-4">{city.codigoSubdivisao}</td>
                      <td className="py-3 px-4 font-sans font-bold">{city.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cityViewMode === 'metadata' && (
            <div className="bg-white rounded-xl border p-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase border-b">
                  <tr>
                    <th className="py-2 px-3">Rótulo</th>
                    <th className="py-2 px-3">Campo</th>
                    <th className="py-2 px-3">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ATIT_CITY_TABLE_METADATA.map((col) => (
                    <tr key={col.nome}>
                      <td className="py-2 px-3 font-bold">{col.rotulo}</td>
                      <td className="py-2 px-3 font-mono text-indigo-600">{col.nome}</td>
                      <td className="py-2 px-3 text-slate-600">{col.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Consult */}
      {activeSubTab === 'quick_consult' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-5 border space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" /> Consulta (stub)
            </h3>
            <form onSubmit={handleExecuteConsult} className="space-y-4">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                {(['due', 'duimp', 'cct'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setConsultType(t)}
                    className={`py-1.5 rounded-md cursor-pointer ${
                      consultType === t ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-slate-600'
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <SearchableSelect
                value={consultDocNumber}
                options={extraCatalogs.declaration_number}
                onChange={setConsultDocNumber}
                allowCustom
                placeholder="Filtrar número / chave…"
              />
              <button
                type="submit"
                disabled={consultLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search className={`w-4 h-4 ${consultLoading ? 'animate-spin' : ''}`} />
                {consultLoading ? 'Consultando...' : 'Consultar Siscomex'}
              </button>
            </form>
            <div className="p-3 bg-slate-50 rounded-lg border text-[11px] text-slate-600">
              <div className="font-semibold flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> Paths oficiais
              </div>
              <p className="font-mono text-[10px] mt-1">
                DU-E: /due/api/ext/due/numero-da-due/{'{n}'}
              </p>
              <p className="font-mono text-[10px]">
                DUIMP: /duimp/api/ext/duimp/{'{n}'}/{'{v}'}
              </p>
              <p className="font-mono text-[10px]">CCTA: /ccta/api/ext/conhecimentos/{'{id}'}</p>
              {consultMode && (
                <p className="mt-2 font-bold text-indigo-700">Última resposta: modo {consultMode}</p>
              )}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-xl p-5 border">
            {consultLoading && (
              <div className="py-16 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              </div>
            )}
            {consultError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {consultError}
              </div>
            )}
            {!consultLoading && !consultResult && !consultError && (
              <div className="py-16 text-center text-slate-400 text-xs">
                Informe o documento e consulte o stub PUCOMEX.
              </div>
            )}
            {consultResult && (
              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-xl text-xs overflow-x-auto font-mono">
                {JSON.stringify(consultResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* AI Audit */}
      {activeSubTab === 'ai_audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-5 border space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" /> Auditoria NCM
            </h3>
            <form onSubmit={handleExecuteAiAudit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">NCM</label>
                <SearchableSelect
                  value={aiNcmCode}
                  options={COMEX_NCM_CATALOG}
                  onChange={setAiNcmCode}
                  allowCustom
                  placeholder="Filtrar NCM…"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SearchableSelect
                  value={aiOperationType}
                  options={[
                    { value: 'importacao', label: 'Importação' },
                    { value: 'exportacao', label: 'Exportação' },
                  ]}
                  onChange={(v) => setAiOperationType((v || 'importacao') as typeof aiOperationType)}
                />
                <input
                  type="number"
                  value={aiFobUsd}
                  onChange={(e) => setAiFobUsd(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>
              <SearchableSelect
                value={aiCountry}
                options={Object.entries(COUNTRY_NAME_MAP).map(([code, label]) => ({
                  value: label,
                  label,
                }))}
                onChange={setAiCountry}
                allowCustom
                placeholder="Filtrar país…"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                {aiLoading ? 'Auditando...' : 'Executar Auditoria'}
              </button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-white rounded-xl p-5 border space-y-3">
            {aiLoading && (
              <div className="py-16 text-center">
                <Sparkles className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
              </div>
            )}
            {aiError && (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl flex gap-2">
                <AlertTriangle className="w-5 h-5" />
                {aiError}
              </div>
            )}
            {!aiLoading && !aiResult && !aiError && (
              <div className="py-16 text-center text-slate-400 text-xs">
                Execute a auditoria para NCM fitness 9506.
              </div>
            )}
            {aiResult && (
              <div className="space-y-3 text-xs">
                <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
                  <div className="font-bold text-violet-900">
                    {(aiResult.productCategory as string) || 'Fitness / NCM 9506'}
                  </div>
                  <p className="text-violet-800 mt-1">{(aiResult.auditSummary as string) || ''}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    Canal: {(aiResult.siscomexChannelRisk as string) || 'Verde'}
                  </span>
                </div>
                {Array.isArray(aiResult.lpcoRequirements) && (
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <h4 className="font-bold mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> LPCO / Anuentes
                    </h4>
                    <ul className="space-y-1">
                      {(aiResult.lpcoRequirements as string[]).map((item, i) => (
                        <li key={i} className="flex gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(aiResult.requiredDocuments) && (
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <h4 className="font-bold mb-2 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" /> Documentos
                    </h4>
                    <ul className="space-y-1">
                      {(aiResult.requiredDocuments as string[]).map((doc, i) => (
                        <li key={i} className="flex gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Docs */}
      {activeSubTab === 'api_docs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Documentação oficial PUCOMEX
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Fonte:{' '}
                  <a
                    className="text-indigo-600 underline"
                    href="https://docs.portalunico.siscomex.gov.br/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    docs.portalunico.siscomex.gov.br
                  </a>
                  {' · '}
                  <a
                    className="text-indigo-600 underline"
                    href="https://docs.portalunico.siscomex.gov.br/introducao-api-publica/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Auth / Role-Type
                  </a>
                  {' · '}
                  <a
                    className="text-indigo-600 underline"
                    href="https://docs.portalunico.siscomex.gov.br/ambientes/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ambientes
                  </a>
                </p>
              </div>
              <a
                href="https://docs.portalunico.siscomex.gov.br/"
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                Abrir portal docs <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              {Object.values(PUCOMEX_ENVIRONMENTS).map((env) => (
                <div key={env.id} className="p-3 rounded-xl border bg-slate-50 space-y-1">
                  <div className="font-bold text-slate-900">{env.label}</div>
                  <div className="font-mono text-[10px] text-indigo-700 break-all">{env.baseUrl}</div>
                  <div className="text-slate-500">{env.availability}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {PUCOMEX_MODULE_LINKS.map((link) => (
                <a
                  key={link.title}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 text-[11px] font-semibold border border-indigo-100"
                >
                  {link.title}
                </a>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-bold text-sm">Catálogo de endpoints no HUB</h4>
              <span className="text-[11px] text-slate-500">
                {endpointCatalog.filter((e) => e.implemented).length}/{endpointCatalog.length} implementados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                  <tr>
                    <th className="py-2 px-3">Módulo</th>
                    <th className="py-2 px-3">Método</th>
                    <th className="py-2 px-3">Path</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {endpointCatalog.map((ep) => (
                    <tr key={ep.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold">{ep.module}</td>
                      <td className="py-2 px-3 font-mono">{ep.method}</td>
                      <td className="py-2 px-3 font-mono text-[10px]">{ep.pathTemplate}</td>
                      <td className="py-2 px-3">
                        {ep.implemented ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                            Proxy OK
                          </span>
                        ) : (
                          <span className="text-slate-400">Via /proxy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 border-t text-[11px] text-slate-600">
              Proxy genérico: <span className="font-mono">POST /api/comex/pucomex/proxy</span> com{' '}
              <span className="font-mono">{`{ method, path, body }`}</span> — exige sessão autenticada.
              Intervalo mínimo entre <span className="font-mono">autenticar</span>: 60s (política Portal).
            </div>
          </div>
        </div>
      )}

      {/* Modal — campos vindos de comex_field_defs */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-600" />
                {editingProcess ? `Editar ${editingProcess.code}` : 'Novo Processo Comex'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            {editingProcess && (editingProcess.documents?.length || 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-teal-50 border border-teal-100">
                <button
                  type="button"
                  disabled={extractBusy}
                  onClick={() => void handleExtractFromPdf('empty')}
                  className="py-1.5 px-3 rounded-lg bg-teal-700 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${extractBusy ? 'animate-spin' : ''}`} />
                  {extractBusy ? 'Lendo PDF…' : 'PDF → JSON → popular vazios'}
                </button>
                <button
                  type="button"
                  disabled={extractBusy}
                  onClick={() => void handleExtractFromPdf('replace')}
                  className="py-1.5 px-3 rounded-lg bg-white border border-teal-200 text-teal-800 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  Substituir todos
                </button>
                {extractMsg ? <span className="text-[11px] text-teal-900">{extractMsg}</span> : (
                  <span className="text-[11px] text-teal-800">
                    {editingProcess.documents?.length} PDF(s) ligados a este BL
                  </span>
                )}
              </div>
            )}
            <form onSubmit={handleSaveProcess} className="space-y-3 text-xs">
              <ComexMetaForm
                fields={formFields}
                payload={formPayload}
                onChange={setFormPayload}
                extraCatalogs={extraCatalogs}
              />
              {extractJson ? (
                <details className="rounded-lg border bg-slate-50 p-2">
                  <summary className="cursor-pointer font-semibold text-slate-600">JSON extraído</summary>
                  <pre className="mt-2 max-h-40 overflow-auto text-[10px] font-mono text-slate-700">
                    {JSON.stringify(extractJson, null, 2)}
                  </pre>
                </details>
              ) : null}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-lg bg-teal-600 text-white font-bold cursor-pointer"
                >
                  {editingProcess ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
