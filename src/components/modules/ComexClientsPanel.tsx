import React, { useEffect, useState } from 'react';
import { Building2, Edit2, FileText, Info, Plus, RefreshCw, Trash2, UserCheck } from 'lucide-react';
import type {
  ComexBrokerRecord,
  ComexClientRecord,
  ComexFieldDef,
  ComexRadarModality,
} from '../../types/comex';
import type { RadarUsage } from '../../core/comex/radarUsage';
import { declarationRouteNote, defaultRadarLimit } from '../../core/comex/comexRegistry';
import { comexFetch } from './comexOperatorToken';
import { RadarUsageBadge } from './RadarUsageBadge';
import { RegistryMetaForm, optionLabel, type RegistryValue } from './RegistryMetaForm';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface ComexClientsPanelProps {
  onChanged?: () => void;
  /** Padrão comexFetch; o M18 passa o cfetch (detecta recusa do token). */
  fetcher?: Fetcher;
}

/** Rascunho do formulário: chaves = field_key dos defs (comex_field_defs). */
type Draft = Record<string, RegistryValue>;

/** Defaults de novo cliente (mesmos do seed/tela anterior). */
const EMPTY_CLIENT: Draft = {
  radar_status: 'habilitada',
  rep_status: 'pendente',
  rep_certificate: 'e-CPF Marcelo',
  rep_role_type: 'IMPEXP',
};

const EMPTY_BROKER: Draft = { active: true };

const DATE_KEYS = new Set(['radar_checked_at', 'rep_valid_from', 'rep_valid_to']);

function toDraft(record: object): Draft {
  const out: Draft = {};
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    if (v === null || v === undefined) out[k] = '';
    else if (typeof v === 'boolean') out[k] = v;
    else out[k] = DATE_KEYS.has(k) ? String(v).slice(0, 10) : String(v);
  }
  return out;
}

/** Só as chaves dos defs vão no corpo; texto vazio vira null. */
function draftToBody(d: Draft, defs: ComexFieldDef[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of defs) {
    const v = d[f.field_key];
    if (typeof v === 'boolean') body[f.field_key] = v;
    else if (f.data_type === 'boolean') body[f.field_key] = false;
    else {
      const t = String(v ?? '').trim();
      body[f.field_key] = t === '' ? null : f.data_type === 'number' ? Number(t) : t;
    }
  }
  return body;
}

function cnpjRootLabel(root: string): string {
  const d = root.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}` : root;
}

async function readJson(res: Response): Promise<{ success?: boolean; error?: string; data?: unknown }> {
  try {
    return await res.json();
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
}

const inputCls = 'w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs';
const labelCls = 'block font-semibold text-slate-600 mb-1 text-xs';

/** Selo curto: o cliente importa por DI (Radar Limitado). */
const DiPill: React.FC = () => (
  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
    <FileText className="h-3 w-3" />
    Declaração: DI
  </span>
);

export const ComexClientsPanel: React.FC<ComexClientsPanelProps> = ({ onChanged, fetcher = comexFetch }) => {
  const [clients, setClients] = useState<ComexClientRecord[]>([]);
  const [brokers, setBrokers] = useState<ComexBrokerRecord[]>([]);
  const [usages, setUsages] = useState<Record<string, RadarUsage>>({});
  const [clientDefs, setClientDefs] = useState<ComexFieldDef[]>([]);
  const [brokerDefs, setBrokerDefs] = useState<ComexFieldDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [defsError, setDefsError] = useState<string | null>(null);

  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<Draft>(EMPTY_CLIENT);
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientBusy, setClientBusy] = useState(false);

  const [brokerFormOpen, setBrokerFormOpen] = useState(false);
  const [editingBrokerId, setEditingBrokerId] = useState<string | null>(null);
  const [brokerDraft, setBrokerDraft] = useState<Draft>(EMPTY_BROKER);
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [brokerBusy, setBrokerBusy] = useState(false);

  const loadUsages = async (list: ComexClientRecord[]) => {
    const entries = await Promise.all(
      list.map(async (c) => {
        try {
          const res = await fetcher(`/api/comex/clients/${encodeURIComponent(c.id)}/radar-usage`);
          const json = await readJson(res);
          return json.success && json.data ? ([c.id, json.data as RadarUsage] as const) : null;
        } catch {
          return null;
        }
      }),
    );
    const next: Record<string, RadarUsage> = {};
    for (const e of entries) if (e) next[e[0]] = e[1];
    setUsages(next);
  };

  /** Falha nos campos não bloqueia as listas — só os formulários ficam indisponíveis. */
  const loadDefs = async () => {
    setDefsError(null);
    try {
      const [cdRes, bdRes] = await Promise.all([
        fetcher('/api/comex/field-defs?entity=client'),
        fetcher('/api/comex/field-defs?entity=broker'),
      ]);
      const [cdJson, bdJson] = await Promise.all([readJson(cdRes), readJson(bdRes)]);
      if (!cdJson.success || !bdJson.success) {
        throw new Error(cdJson.error || bdJson.error || `HTTP ${cdRes.status}/${bdRes.status}`);
      }
      setClientDefs(Array.isArray(cdJson.data) ? (cdJson.data as ComexFieldDef[]) : []);
      setBrokerDefs(Array.isArray(bdJson.data) ? (bdJson.data as ComexFieldDef[]) : []);
    } catch (err) {
      setDefsError(`Campos não carregados: ${err instanceof Error ? err.message : 'falha de rede'}`);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setListError(null);
    void loadDefs();
    try {
      const [cRes, bRes] = await Promise.all([fetcher('/api/comex/clients'), fetcher('/api/comex/brokers')]);
      const [cJson, bJson] = await Promise.all([readJson(cRes), readJson(bRes)]);
      if (!cJson.success) throw new Error(cJson.error || 'Falha ao carregar clientes');
      if (!bJson.success) throw new Error(bJson.error || 'Falha ao carregar despachantes');
      const list = Array.isArray(cJson.data) ? (cJson.data as ComexClientRecord[]) : [];
      setClients(list);
      setBrokers(Array.isArray(bJson.data) ? (bJson.data as ComexBrokerRecord[]) : []);
      await loadUsages(list);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setC = (key: string, value: RegistryValue) =>
    setClientDraft((d) => {
      if (key !== 'radar_modality') return { ...d, [key]: value };
      // trocar a modalidade preenche o limite padrão (continua editável)
      const m = String(value || '') as ComexRadarModality | '';
      const limit = m ? defaultRadarLimit(m) : null;
      return { ...d, radar_modality: value, radar_limit_usd: limit == null ? '' : String(limit) };
    });

  const openNewClient = () => {
    setEditingClientId(null);
    setClientDraft(EMPTY_CLIENT);
    setClientError(null);
    setClientFormOpen(true);
  };

  const openEditClient = (c: ComexClientRecord) => {
    setEditingClientId(c.id);
    setClientDraft(toDraft(c));
    setClientError(null);
    setClientFormOpen(true);
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientBusy(true);
    setClientError(null);
    try {
      const path = editingClientId
        ? `/api/comex/clients/${encodeURIComponent(editingClientId)}`
        : '/api/comex/clients';
      const res = await fetcher(path, {
        method: editingClientId ? 'PUT' : 'POST',
        body: JSON.stringify(draftToBody(clientDraft, clientDefs)),
      });
      const json = await readJson(res);
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setClientFormOpen(false);
      await loadAll();
      onChanged?.();
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Falha ao salvar cliente');
    } finally {
      setClientBusy(false);
    }
  };

  const deleteClient = async (c: ComexClientRecord) => {
    if (!window.confirm(`Excluir o cliente ${c.legal_name}?`)) return;
    setListError(null);
    try {
      const res = await fetcher(`/api/comex/clients/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      const json = await readJson(res);
      if (!json.success) {
        setListError(json.error || `Falha ao excluir (HTTP ${res.status})`);
        return;
      }
      await loadAll();
      onChanged?.();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Falha de rede ao excluir cliente');
    }
  };

  const openNewBroker = () => {
    setEditingBrokerId(null);
    setBrokerDraft(EMPTY_BROKER);
    setBrokerError(null);
    setBrokerFormOpen(true);
  };

  const openEditBroker = (b: ComexBrokerRecord) => {
    setEditingBrokerId(b.id);
    setBrokerDraft(toDraft(b));
    setBrokerError(null);
    setBrokerFormOpen(true);
  };

  const saveBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrokerBusy(true);
    setBrokerError(null);
    try {
      const path = editingBrokerId
        ? `/api/comex/brokers/${encodeURIComponent(editingBrokerId)}`
        : '/api/comex/brokers';
      const res = await fetcher(path, {
        method: editingBrokerId ? 'PUT' : 'POST',
        body: JSON.stringify(draftToBody(brokerDraft, brokerDefs)),
      });
      const json = await readJson(res);
      if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setBrokerFormOpen(false);
      await loadAll();
    } catch (err) {
      setBrokerError(err instanceof Error ? err.message : 'Falha ao salvar despachante');
    } finally {
      setBrokerBusy(false);
    }
  };

  const deleteBroker = async (b: ComexBrokerRecord) => {
    if (!window.confirm(`Excluir o despachante ${b.name}?`)) return;
    setListError(null);
    try {
      const res = await fetcher(`/api/comex/brokers/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
      const json = await readJson(res);
      if (!json.success) {
        setListError(json.error || `Falha ao excluir (HTTP ${res.status})`);
        return;
      }
      await loadAll();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Falha de rede ao excluir despachante');
    }
  };

  const brokerName = (id: string | null) => (id ? brokers.find((b) => b.id === id)?.name || '—' : '—');
  const modalityLabel = (m: string | null) => optionLabel(clientDefs, 'radar_modality', m);
  const radarNote = declarationRouteNote((String(clientDraft.radar_modality || '') || null) as ComexRadarModality | null);

  return (
    <div className="space-y-4">
      {listError ? (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">{listError}</div>
      ) : null}
      {defsError ? (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs">
          {defsError} — os formulários de cadastro ficam indisponíveis até clicar em Atualizar.
        </div>
      ) : null}

      {/* Clientes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Clientes importadores ({clients.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              className="py-1 px-2.5 border border-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={openNewClient}
              className="py-1 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo cliente
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b">
              <tr>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Radar</th>
                <th className="py-3 px-4">Uso do limite</th>
                <th className="py-3 px-4">Representação</th>
                <th className="py-3 px-4">Despachante</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {loading ? 'Carregando…' : 'Nenhum cliente cadastrado.'}
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 align-top">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{c.legal_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {cnpjRootLabel(c.cnpj_root)}
                        {c.trade_name ? ` · ${c.trade_name}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{modalityLabel(c.radar_modality)}</div>
                      {declarationRouteNote(c.radar_modality) ? (
                        <span title={declarationRouteNote(c.radar_modality) ?? ''}>
                          <DiPill />
                        </span>
                      ) : null}
                      <div className="text-[10px] text-slate-400">
                        {optionLabel(clientDefs, 'radar_status', c.radar_status)}
                        {c.radar_operations ? ` · ${c.radar_operations}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {usages[c.id] ? (
                        <RadarUsageBadge usage={usages[c.id]} compact />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div>{optionLabel(clientDefs, 'rep_status', c.rep_status)}</div>
                      <div className="text-[10px] text-slate-400">
                        {c.rep_certificate || '—'}
                        {c.rep_role_type ? ` · ${c.rep_role_type}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">{brokerName(c.broker_id)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => openEditClient(c)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => void deleteClient(c)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Despachantes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 border-b">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            Despachantes ({brokers.length})
          </h3>
          <button
            type="button"
            onClick={openNewBroker}
            className="py-1 px-2.5 rounded-lg bg-teal-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo despachante
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">CPF · Registro RFB</th>
                <th className="py-3 px-4">Contato</th>
                <th className="py-3 px-4">Certificado</th>
                <th className="py-3 px-4">Ativo</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brokers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Nenhum despachante cadastrado.
                  </td>
                </tr>
              ) : (
                brokers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">{b.name}</td>
                    <td className="py-3 px-4">
                      {b.cpf || '—'} · {b.rfb_registry || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {b.email || '—'}
                      {b.phone ? ` · ${b.phone}` : ''}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {b.certificate_status || 'pendente'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{b.active ? 'Sim' : 'Não'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => openEditBroker(b)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => void deleteBroker(b)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal cliente */}
      {clientFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                {editingClientId ? 'Editar cliente' : 'Novo cliente importador'}
              </h3>
              <button type="button" onClick={() => setClientFormOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={saveClient} className="space-y-4 text-xs">
              {clientDefs.length === 0 ? (
                <p className="text-slate-500">Campos do cadastro não carregados — clique em Atualizar.</p>
              ) : (
                <RegistryMetaForm
                  fields={clientDefs}
                  values={clientDraft}
                  onChange={setC}
                  brokers={brokers}
                  renderAfter={(key) => (key === 'radar_modality' && radarNote ? <DiPill /> : null)}
                  renderGroupFooter={(group) =>
                    group === 'Radar' && radarNote ? (
                      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="space-y-0.5">
                          <p className="text-[12px] font-semibold text-amber-900">Importação deste cliente segue por DI</p>
                          <p className="text-[11px] leading-relaxed text-amber-800/90">
                            Radar Limitado não pode registrar DUIMP, conforme o cronograma de desligamento da DI da
                            Receita. Confirme o caminho com o despachante antes do embarque.
                          </p>
                        </div>
                      </div>
                    ) : null
                  }
                />
              )}

              {clientError ? (
                <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800">{clientError}</div>
              ) : null}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setClientFormOpen(false)}
                  className="py-2 px-4 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={clientBusy}
                  className="py-2 px-5 rounded-lg bg-indigo-600 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {clientBusy ? 'Salvando…' : editingClientId ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal despachante */}
      {brokerFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600" />
                {editingBrokerId ? 'Editar despachante' : 'Novo despachante'}
              </h3>
              <button type="button" onClick={() => setBrokerFormOpen(false)} className="text-slate-400 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={saveBroker} className="space-y-3 text-xs">
              {brokerDefs.length === 0 ? (
                <p className="text-slate-500">Campos do cadastro não carregados — clique em Atualizar.</p>
              ) : (
                <RegistryMetaForm
                  fields={brokerDefs}
                  values={brokerDraft}
                  onChange={(key, value) => setBrokerDraft((d) => ({ ...d, [key]: value }))}
                />
              )}
              <div>
                <label className={labelCls}>Certificado</label>
                <input readOnly value="pendente" className={`${inputCls} text-slate-500 cursor-not-allowed`} />
              </div>
              {brokerError ? (
                <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800">{brokerError}</div>
              ) : null}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setBrokerFormOpen(false)}
                  className="py-2 px-4 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={brokerBusy}
                  className="py-2 px-5 rounded-lg bg-teal-600 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {brokerBusy ? 'Salvando…' : editingBrokerId ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
