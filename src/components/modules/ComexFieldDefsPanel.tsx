import React, { useEffect, useState } from 'react';
import type {
  ComexEnumOption,
  ComexFieldDef,
  ComexFieldDefInput,
  ComexFieldEntity,
  ComexFieldWidget,
} from '../../types/comex';
import { isLockedField, isSystemField } from '../../core/comex/comexRegistry';
import { SearchableSelect } from '../ui/SearchableSelect';
import { comexFetch } from './comexOperatorToken';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
type PanelEntity = Extract<ComexFieldEntity, 'process' | 'client' | 'broker'>;

interface ComexFieldDefsPanelProps {
  /** Campos de processo (o M18 já os carrega para o formulário de processo). */
  fields: ComexFieldDef[];
  onReload: () => Promise<void>;
  /** Padrão comexFetch; o M18 passa o cfetch. */
  fetcher?: Fetcher;
}

const ENTITY_TABS: { value: PanelEntity; label: string }[] = [
  { value: 'process', label: 'Processo' },
  { value: 'client', label: 'Cliente' },
  { value: 'broker', label: 'Despachante' },
];

type Draft = ComexFieldDefInput & { optionsText: string };

const emptyDraft = (entity: PanelEntity, sort_order = 200): Draft => ({
  entity,
  field_key: '',
  label: '',
  data_type: 'text',
  widget: 'text',
  required: false,
  ui_list: true,
  ui_form: true,
  consult_key: false,
  sort_order,
  ui_group: null,
  optionsText: '',
});

/** "valor=Rótulo" por linha (sem "=", valor e rótulo iguais). */
export function parseOptionsText(text: string): ComexEnumOption[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      if (i < 0) return { value: line, label: line };
      const value = line.slice(0, i).trim();
      const label = line.slice(i + 1).trim() || value;
      return { value, label };
    });
}

function optionsToText(options: ComexEnumOption[] = []): string {
  return options.map((o) => `${o.value}=${o.label}`).join('\n');
}

async function readJson(res: Response): Promise<{ success?: boolean; error?: string; data?: unknown }> {
  try {
    return await res.json();
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
}

const inputCls = 'px-2 py-1.5 border rounded-lg';

export const ComexFieldDefsPanel: React.FC<ComexFieldDefsPanelProps> = ({ fields, onReload, fetcher = comexFetch }) => {
  const [entity, setEntity] = useState<PanelEntity>('process');
  const [ownDefs, setOwnDefs] = useState<ComexFieldDef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft('process'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = entity === 'process' ? fields : ownDefs;
  const isRegistry = entity !== 'process';

  const loadOwn = async (e: PanelEntity) => {
    if (e === 'process') return;
    const res = await fetcher(`/api/comex/field-defs?entity=${e}`);
    const json = await readJson(res);
    if (!json.success) throw new Error(json.error || 'Falha ao carregar campos');
    setOwnDefs(Array.isArray(json.data) ? (json.data as ComexFieldDef[]) : []);
  };

  const reload = async () => {
    if (entity === 'process') await onReload();
    else await loadOwn(entity);
  };

  useEffect(() => {
    setEditingId(null);
    setDraft(emptyDraft(entity));
    setError(null);
    setOwnDefs([]);
    loadOwn(entity).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const startEdit = (f: ComexFieldDef) => {
    setEditingId(f.id);
    setDraft({ ...f, optionsText: optionsToText(f.enum_options) });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft(entity, (shown.at(-1)?.sort_order || 200) + 10));
    setError(null);
  };

  const locked = isLockedField(draft.entity, draft.field_key);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.field_key || !draft.label) return;
    setSaving(true);
    setError(null);
    try {
      const { optionsText, ...rest } = draft;
      const body: ComexFieldDefInput = {
        ...rest,
        entity,
        ui_group: rest.ui_group?.trim() ? rest.ui_group.trim() : null,
        enum_options: parseOptionsText(optionsText),
      };
      const res = await fetcher(
        editingId ? `/api/comex/field-defs/${encodeURIComponent(editingId)}` : '/api/comex/field-defs',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await readJson(res);
      if (!json.success) throw new Error(json.error || 'Falha ao salvar campo');
      await reload();
      setEditingId(null);
      setDraft(emptyDraft(entity, (shown.at(-1)?.sort_order || 200) + 10));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remover este campo de metadado? Valores já gravados no payload permanecem.')) return;
    setError(null);
    const res = await fetcher(`/api/comex/field-defs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = await readJson(res);
    if (!json.success) setError(json.error || `Falha ao excluir (HTTP ${res.status})`);
    await reload();
  };

  const showForm = !isRegistry || editingId !== null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm">Campos (metadado)</h4>
          <p className="text-[11px] text-slate-500">
            CRUD em <span className="font-mono">comex_field_defs</span> — formulários e grades leem daqui, não de colunas
            hardcoded.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]" role="tablist">
          {ENTITY_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={entity === t.value}
              onClick={() => setEntity(t.value)}
              className={`px-3 py-1 cursor-pointer ${
                entity === t.value ? 'bg-slate-800 text-white font-semibold' : 'bg-white text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="text-left py-1">Chave</th>
              <th className="text-left py-1">Rótulo</th>
              {isRegistry ? <th className="text-left py-1">Grupo</th> : null}
              <th className="text-left py-1">Tipo</th>
              <th className="text-left py-1">Lista</th>
              {isRegistry ? null : <th className="text-left py-1">Consulta</th>}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((f) => (
              <tr key={f.id} className={editingId === f.id ? 'bg-amber-50' : undefined}>
                <td className="py-1 font-mono">
                  {f.field_key}
                  {isLockedField(f.entity, f.field_key) ? (
                    <span title="Valores usados pelo cálculo do Radar — só rótulo/ordem"> 🔒</span>
                  ) : null}
                </td>
                <td className="py-1">
                  {f.label}
                  {f.required ? <span className="text-rose-500"> *</span> : null}
                </td>
                {isRegistry ? <td className="py-1">{f.ui_group || '—'}</td> : null}
                <td className="py-1">
                  {f.data_type}/{f.widget}
                </td>
                <td className="py-1">{f.ui_list ? 'sim' : '—'}</td>
                {isRegistry ? null : <td className="py-1">{f.consult_key ? 'Portal' : '—'}</td>}
                <td className="py-1 text-right whitespace-nowrap space-x-2">
                  <button type="button" onClick={() => startEdit(f)} className="text-indigo-600 hover:underline cursor-pointer">
                    editar
                  </button>
                  {isSystemField(f.entity, f.field_key) ? null : (
                    <button
                      type="button"
                      onClick={() => void remove(f.id)}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isRegistry && !showForm ? (
        <p className="text-[11px] text-slate-500">
          Os campos do cadastro são colunas da tabela: edite rótulo, grupo, ordem, obrigatoriedade e opções.
        </p>
      ) : null}
      {showForm ? (
        <form onSubmit={save} className="space-y-2 border-t pt-3">
          <div className="text-[11px] font-semibold text-slate-600">
            {editingId ? `Editando ${draft.field_key}` : 'Novo campo'}
          </div>
          {locked ? (
            <p className="text-[11px] text-amber-700">
              🔒 valores usados pelo cálculo do Radar — só rótulo/ordem
            </p>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <input
              required
              placeholder="field_key"
              disabled={editingId !== null}
              value={draft.field_key}
              onChange={(e) => setDraft({ ...draft, field_key: e.target.value.replace(/\s+/g, '_') })}
              className={`${inputCls} font-mono disabled:bg-slate-100`}
            />
            <input
              required
              placeholder="Rótulo"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Grupo (seção)"
              value={draft.ui_group || ''}
              onChange={(e) => setDraft({ ...draft, ui_group: e.target.value })}
              className={inputCls}
            />
            <input
              type="number"
              placeholder="Ordem"
              value={draft.sort_order ?? 0}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
              className={inputCls}
            />
            <SearchableSelect
              value={draft.data_type}
              disabled={locked}
              options={[
                { value: 'text', label: 'text' },
                { value: 'number', label: 'number' },
                { value: 'date', label: 'date' },
                { value: 'enum', label: 'enum (lista fechada)' },
                { value: 'boolean', label: 'boolean' },
              ]}
              onChange={(v) => setDraft({ ...draft, data_type: (v || 'text') as ComexFieldDefInput['data_type'] })}
            />
            <SearchableSelect
              value={draft.widget || 'text'}
              disabled={locked}
              options={[
                { value: 'text', label: 'widget: texto' },
                { value: 'select', label: 'widget: lista + filtro' },
                { value: 'date', label: 'widget: data' },
                { value: 'client', label: 'widget: clientes' },
                { value: 'broker', label: 'widget: despachantes' },
                { value: 'ncm', label: 'widget: NCM' },
                { value: 'port', label: 'widget: portos' },
                { value: 'customs', label: 'widget: recinto/URF' },
                { value: 'textarea', label: 'widget: textarea' },
                { value: 'number', label: 'widget: número' },
              ]}
              onChange={(v) => setDraft({ ...draft, widget: (v || 'text') as ComexFieldWidget })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!draft.required}
                onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              />
              obrigatório
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!draft.ui_list}
                onChange={(e) => setDraft({ ...draft, ui_list: e.target.checked })}
              />
              lista
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.ui_form !== false}
                onChange={(e) => setDraft({ ...draft, ui_form: e.target.checked })}
              />
              formulário
            </label>
            {isRegistry ? null : (
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!draft.consult_key}
                  onChange={(e) => setDraft({ ...draft, consult_key: e.target.checked })}
                />
                consulta Portal
              </label>
            )}
          </div>
          <label className="block text-[11px] text-slate-600">
            Opções — uma por linha, no formato <span className="font-mono">valor=Rótulo</span> (enum = lista fechada;
            texto com widget lista = sugestões)
            <textarea
              rows={4}
              value={draft.optionsText}
              onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
              className={`${inputCls} w-full font-mono mt-1`}
              placeholder={'habilitada=Habilitada\nsuspensa=Suspensa'}
            />
          </label>
          <div className="flex justify-end gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="py-1.5 px-3 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="py-1.5 px-3 rounded-lg bg-slate-800 text-white font-semibold cursor-pointer"
            >
              {saving ? '…' : editingId ? 'Salvar campo' : 'Adicionar campo'}
            </button>
          </div>
        </form>
      ) : null}
      {error ? <p className="text-rose-600 text-[11px]">{error}</p> : null}
    </div>
  );
};
