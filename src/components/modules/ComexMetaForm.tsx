import React from 'react';
import type { ComexEnumOption, ComexFieldDef } from '../../types/comex';
import { COMEX_PORTS_DATA } from '../../data/comexPortsData';
import {
  COMEX_CLIENT_CATALOG,
  COMEX_CUSTOMS_CATALOG,
  COMEX_NCM_CATALOG,
  mergeCatalog,
} from '../../data/comexCatalogs';
import { SearchableSelect } from '../ui/SearchableSelect';

interface ComexMetaFormProps {
  fields: ComexFieldDef[];
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  extraCatalogs?: Record<string, ComexEnumOption[]>;
}

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

const CLOSED_ENUM_KEYS = new Set(['type', 'incoterm', 'duimp_version']);

function optionsFor(field: ComexFieldDef, extra: ComexEnumOption[]): ComexEnumOption[] {
  if (field.widget === 'port') {
    return mergeCatalog(
      COMEX_PORTS_DATA.map((p) => ({
        value: p.codigo,
        label: `${p.codigo} — ${p.descricao}`,
      })),
      extra,
    );
  }
  if (field.widget === 'client') return mergeCatalog(COMEX_CLIENT_CATALOG, extra);
  if (field.widget === 'ncm') return mergeCatalog(COMEX_NCM_CATALOG, extra);
  if (field.widget === 'customs') return mergeCatalog(COMEX_CUSTOMS_CATALOG, extra);
  return mergeCatalog(field.enum_options || [], extra);
}

export const ComexMetaForm: React.FC<ComexMetaFormProps> = ({
  fields,
  payload,
  onChange,
  extraCatalogs = {},
}) => {
  const setField = (key: string, value: unknown) => {
    onChange({ ...payload, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      {fields
        .filter((f) => f.ui_form !== false)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((field) => {
          const value = payload[field.field_key];
          const label = (
            <label className="block font-semibold text-slate-600 mb-1">
              {field.label}
              {field.required ? <span className="text-rose-500"> *</span> : null}
            </label>
          );

          if (field.widget === 'textarea') {
            return (
              <div key={field.id}>
                {label}
                <textarea
                  required={field.required}
                  rows={2}
                  value={asString(value)}
                  onChange={(e) => setField(field.field_key, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>
            );
          }

          if (field.widget === 'number' || field.data_type === 'number') {
            return (
              <div key={field.id}>
                {label}
                <input
                  required={field.required}
                  type="number"
                  value={asString(value)}
                  onChange={(e) =>
                    setField(field.field_key, e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>
            );
          }

          if (field.widget === 'date' || field.data_type === 'date') {
            return (
              <div key={field.id}>
                {label}
                <input
                  required={field.required}
                  type="date"
                  value={asString(value).slice(0, 10)}
                  onChange={(e) => setField(field.field_key, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>
            );
          }

          const extras = extraCatalogs[field.field_key] || [];
          const isCatalog =
            field.widget === 'select' ||
            field.widget === 'port' ||
            field.widget === 'client' ||
            field.widget === 'ncm' ||
            field.widget === 'customs' ||
            field.data_type === 'enum' ||
            extras.length > 0 ||
            (field.enum_options || []).length > 0;

          if (!isCatalog) {
            return (
              <div key={field.id}>
                {label}
                <input
                  required={field.required}
                  value={asString(value)}
                  onChange={(e) => setField(field.field_key, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>
            );
          }

          const options = optionsFor(field, extras);
          const allowCustom = !CLOSED_ENUM_KEYS.has(field.field_key);

          return (
            <div key={field.id}>
              {label}
              <SearchableSelect
                required={field.required}
                value={asString(value)}
                options={options}
                onChange={(next) => setField(field.field_key, next)}
                allowCustom={allowCustom}
                placeholder={`Filtrar ${field.label.toLowerCase()}…`}
              />
            </div>
          );
        })}
    </div>
  );
};
