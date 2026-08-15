import React, { useState } from 'react';
import type { ComexFieldDef, ComexFieldDefInput, ComexFieldWidget } from '../../types/comex';
import { SearchableSelect } from '../ui/SearchableSelect';

interface ComexFieldDefsPanelProps {
  fields: ComexFieldDef[];
  onReload: () => Promise<void>;
}

const EMPTY: ComexFieldDefInput = {
  entity: 'process',
  field_key: '',
  label: '',
  data_type: 'text',
  widget: 'text',
  required: false,
  ui_list: true,
  ui_form: true,
  consult_key: false,
  sort_order: 200,
};

export const ComexFieldDefsPanel: React.FC<ComexFieldDefsPanelProps> = ({ fields, onReload }) => {
  const [draft, setDraft] = useState<ComexFieldDefInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.field_key || !draft.label) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/comex/field-defs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao salvar campo');
      setDraft({ ...EMPTY, sort_order: (fields.at(-1)?.sort_order || 200) + 10 });
      await onReload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remover este campo de metadado? Valores já gravados no payload permanecem.')) return;
    await fetch(`/api/comex/field-defs/${id}`, { method: 'DELETE' });
    await onReload();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div>
        <h4 className="font-bold text-sm">Campos do projeto (metadado)</h4>
        <p className="text-[11px] text-slate-500">
          CRUD em <span className="font-mono">comex_field_defs</span> — o formulário e a grade leem daqui, não de colunas
          hardcoded.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="text-left py-1">Chave</th>
              <th className="text-left py-1">Rótulo</th>
              <th className="text-left py-1">Tipo</th>
              <th className="text-left py-1">Lista</th>
              <th className="text-left py-1">Consulta</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((f) => (
              <tr key={f.id}>
                <td className="py-1 font-mono">{f.field_key}</td>
                <td className="py-1">{f.label}</td>
                <td className="py-1">{f.data_type}/{f.widget}</td>
                <td className="py-1">{f.ui_list ? 'sim' : '—'}</td>
                <td className="py-1">{f.consult_key ? 'Portal' : '—'}</td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => void remove(f.id)}
                    className="text-rose-600 hover:underline cursor-pointer"
                  >
                    excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <input
          required
          placeholder="field_key"
          value={draft.field_key}
          onChange={(e) => setDraft({ ...draft, field_key: e.target.value.replace(/\s+/g, '_') })}
          className="px-2 py-1.5 border rounded-lg font-mono"
        />
        <input
          required
          placeholder="Rótulo"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          className="px-2 py-1.5 border rounded-lg"
        />
        <SearchableSelect
          value={draft.data_type}
          options={[
            { value: 'text', label: 'text' },
            { value: 'number', label: 'number' },
            { value: 'date', label: 'date' },
            { value: 'enum', label: 'enum' },
            { value: 'boolean', label: 'boolean' },
          ]}
          onChange={(v) =>
            setDraft({ ...draft, data_type: (v || 'text') as ComexFieldDefInput['data_type'] })
          }
        />
        <SearchableSelect
          value={draft.widget || 'text'}
          options={[
            { value: 'text', label: 'widget: texto' },
            { value: 'select', label: 'widget: lista + filtro' },
            { value: 'client', label: 'widget: clientes' },
            { value: 'ncm', label: 'widget: NCM' },
            { value: 'port', label: 'widget: portos' },
            { value: 'customs', label: 'widget: recinto/URF' },
            { value: 'textarea', label: 'widget: textarea' },
            { value: 'number', label: 'widget: número' },
          ]}
          onChange={(v) => setDraft({ ...draft, widget: (v || 'text') as ComexFieldWidget })}
        />
        <label className="text-[11px] flex items-center gap-1">
          <input
            type="checkbox"
            checked={!!draft.ui_list}
            onChange={(e) => setDraft({ ...draft, ui_list: e.target.checked })}
          />
          lista
        </label>
        <label className="text-[11px] flex items-center gap-1">
          <input
            type="checkbox"
            checked={!!draft.consult_key}
            onChange={(e) => setDraft({ ...draft, consult_key: e.target.checked })}
          />
          consulta Portal
        </label>
        <button
          type="submit"
          disabled={saving}
          className="py-1.5 px-3 rounded-lg bg-slate-800 text-white font-semibold cursor-pointer"
        >
          {saving ? '…' : 'Adicionar campo'}
        </button>
      </form>
      {error ? <p className="text-rose-600 text-[11px]">{error}</p> : null}
    </div>
  );
};
