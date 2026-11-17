import React from 'react';
import type { ComexFieldDef } from '../../types/comex';
import { SearchableSelect } from '../ui/SearchableSelect';

/**
 * Formulário de cadastro (cliente importador / despachante) montado a partir
 * de comex_field_defs — mesmo mecanismo do ComexMetaForm do processo, com
 * seções por ui_group. Regra de lista: data_type 'enum' = fechada (<select>);
 * widget 'select' com data_type 'text' = aberta (sugestões + valor livre).
 */

export type RegistryValue = string | boolean;

export interface RegistryBrokerOption {
  id: string;
  name: string;
  active?: boolean;
}

interface RegistryMetaFormProps {
  fields: ComexFieldDef[];
  values: Record<string, RegistryValue>;
  onChange: (key: string, value: RegistryValue) => void;
  brokers?: RegistryBrokerOption[];
  /** Conteúdo extra abaixo de um campo (ex.: selo curto abaixo da modalidade). */
  renderAfter?: (fieldKey: string) => React.ReactNode;
  /** Conteúdo em largura total no fim de um grupo (ex.: aviso de DI no fim do grupo Radar). */
  renderGroupFooter?: (groupName: string) => React.ReactNode;
}

export interface FieldGroup {
  name: string;
  fields: ComexFieldDef[];
}

/** Agrupa os campos de formulário por ui_group, na ordem do primeiro sort_order de cada grupo. */
export function groupFieldDefs(fields: ComexFieldDef[]): FieldGroup[] {
  const sorted = fields
    .filter((f) => f.ui_form !== false)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.field_key.localeCompare(b.field_key));
  const groups: FieldGroup[] = [];
  for (const f of sorted) {
    const name = f.ui_group || 'Outros';
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, fields: [] };
      groups.push(g);
    }
    g.fields.push(f);
  }
  return groups;
}

/** Rótulo da opção do def para exibir um valor (cai no próprio valor). */
export function optionLabel(fields: ComexFieldDef[], fieldKey: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const v = String(value);
  const def = fields.find((f) => f.field_key === fieldKey);
  return def?.enum_options?.find((o) => String(o.value) === v)?.label || v;
}

/** Rótulo do campo no metadado (cai no fallback). */
export function fieldLabel(fields: ComexFieldDef[], fieldKey: string, fallback: string): string {
  return fields.find((f) => f.field_key === fieldKey)?.label || fallback;
}

const inputCls = 'w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs';
const labelCls = 'block font-semibold text-slate-600 mb-1 text-xs';

function str(v: RegistryValue | undefined): string {
  if (v === undefined || v === null || typeof v === 'boolean') return '';
  return String(v);
}

export const RegistryMetaForm: React.FC<RegistryMetaFormProps> = ({
  fields,
  values,
  onChange,
  brokers = [],
  renderAfter,
  renderGroupFooter,
}) => {
  const renderInput = (f: ComexFieldDef) => {
    const key = f.field_key;
    const value = values[key];

    if (f.data_type === 'boolean') {
      return (
        <label className="flex items-center gap-2 font-semibold text-slate-600 text-xs mt-1">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(key, e.target.checked)} />
          {f.label}
        </label>
      );
    }

    if (f.widget === 'broker') {
      const current = str(value);
      const visible = brokers.filter((b) => b.active !== false || b.id === current);
      return (
        <select
          required={f.required}
          value={current}
          onChange={(e) => onChange(key, e.target.value)}
          className={inputCls}
        >
          <option value="">— nenhum —</option>
          {visible.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.active === false ? ' (inativo)' : ''}
            </option>
          ))}
        </select>
      );
    }

    if (f.data_type === 'enum') {
      const current = str(value);
      // valor gravado que saiu da lista: continua visível e selecionado
      const legacy = current !== '' && !f.enum_options.some((o) => String(o.value) === current);
      return (
        <select
          required={f.required}
          value={current}
          onChange={(e) => onChange(key, e.target.value)}
          className={inputCls}
        >
          {f.required ? null : <option value="">—</option>}
          {legacy ? <option value={current}>{`${current} (valor antigo)`}</option> : null}
          {f.enum_options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    if (f.widget === 'select') {
      return (
        <SearchableSelect
          required={f.required}
          value={str(value)}
          options={f.enum_options}
          onChange={(next) => onChange(key, next)}
          allowCustom
          placeholder={`Filtrar ${f.label.toLowerCase()}…`}
        />
      );
    }

    if (f.data_type === 'date' || f.widget === 'date') {
      return (
        <input
          type="date"
          required={f.required}
          value={str(value).slice(0, 10)}
          onChange={(e) => onChange(key, e.target.value)}
          className={inputCls}
        />
      );
    }

    if (f.data_type === 'number' || f.widget === 'number') {
      return (
        <input
          type="number"
          min={0}
          required={f.required}
          value={str(value)}
          onChange={(e) => onChange(key, e.target.value)}
          className={inputCls}
        />
      );
    }

    if (f.widget === 'textarea') {
      return (
        <textarea
          rows={2}
          required={f.required}
          value={str(value)}
          onChange={(e) => onChange(key, e.target.value)}
          className={inputCls}
        />
      );
    }

    return (
      <input
        required={f.required}
        value={str(value)}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputCls}
      />
    );
  };

  return (
    <div className="space-y-4 text-xs">
      {groupFieldDefs(fields).map((g, i) => (
        <fieldset key={g.name} className={`space-y-3 ${i > 0 ? 'border-t pt-3' : ''}`}>
          <legend className="font-bold text-slate-800 text-[11px] uppercase mb-2">{g.name}</legend>
          <div className="grid sm:grid-cols-3 gap-3">
            {g.fields.map((f) => (
              <div key={f.id}>
                {f.data_type === 'boolean' ? null : (
                  <label className={labelCls}>
                    {f.label}
                    {f.required ? <span className="text-rose-500"> *</span> : null}
                  </label>
                )}
                {renderInput(f)}
                {renderAfter?.(f.field_key)}
              </div>
            ))}
          </div>
          {renderGroupFooter?.(g.name)}
        </fieldset>
      ))}
    </div>
  );
};
