import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegistryMetaForm, groupFieldDefs, optionLabel } from '../components/modules/RegistryMetaForm';
import type { ComexFieldDef } from '../types/comex';

const def = (over: Partial<ComexFieldDef>): ComexFieldDef => ({
  id: over.field_key || 'x',
  entity: 'client',
  field_key: 'x',
  label: 'X',
  data_type: 'text',
  required: false,
  enum_options: [],
  widget: 'text',
  ui_list: false,
  ui_form: true,
  consult_key: false,
  kpi: null,
  sort_order: 0,
  ui_group: null,
  ...over,
});

const fields = [
  def({ field_key: 'radar_modality', label: 'Modalidade', ui_group: 'Radar', sort_order: 120, data_type: 'enum', widget: 'select', enum_options: [{ value: 'expressa', label: 'Expressa' }] }),
  def({ field_key: 'legal_name', label: 'Razão social', ui_group: 'Empresa', sort_order: 30, required: true }),
  def({ field_key: 'broker_id', label: 'Despachante responsável', ui_group: 'Despachante', sort_order: 310, widget: 'broker' }),
  def({ field_key: 'active', label: 'Ativo', ui_group: 'Despachante', sort_order: 320, data_type: 'boolean' }),
  def({ field_key: 'escondido', label: 'Escondido', ui_group: 'Empresa', sort_order: 1, ui_form: false }),
];

describe('RegistryMetaForm', () => {
  it('agrupa por ui_group na ordem do primeiro sort_order', () => {
    const groups = groupFieldDefs(fields);
    expect(groups.map((g) => g.name)).toEqual(['Empresa', 'Radar', 'Despachante']);
    expect(groups[0].fields.map((f) => f.field_key)).toEqual(['legal_name']);
  });

  it('optionLabel usa o rótulo da opção do def', () => {
    expect(optionLabel(fields, 'radar_modality', 'expressa')).toBe('Expressa');
    expect(optionLabel(fields, 'radar_modality', 'outra')).toBe('outra');
    expect(optionLabel(fields, 'radar_modality', null)).toBe('—');
  });

  it('renderiza select fechado, broker ativo, checkbox, obrigatório e renderAfter', () => {
    const html = renderToStaticMarkup(
      React.createElement(RegistryMetaForm, {
        fields,
        values: { legal_name: 'ACME', radar_modality: 'expressa', active: true, broker_id: '' },
        onChange: () => undefined,
        brokers: [
          { id: 'b1', name: 'Despachante A', active: true },
          { id: 'b2', name: 'Despachante B', active: false },
        ],
        renderAfter: (k: string) => (k === 'radar_modality' ? React.createElement('p', null, 'AVISO-DI') : null),
      }),
    );
    expect(html.indexOf('Empresa')).toBeLessThan(html.indexOf('Radar'));
    expect(html).toContain('Razão social');
    expect(html).toMatch(/Razão social<span[^>]*> \*<\/span>/);
    expect(html).toContain('<option value="expressa" selected="">Expressa</option>');
    expect(html).toContain('— nenhum —');
    expect(html).toContain('Despachante A');
    expect(html).not.toContain('Despachante B');
    expect(html).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toContain('AVISO-DI');
    expect(html).not.toContain('Escondido');
  });
});

describe('RegistryMetaForm · valor antigo', () => {
  it('enum fechado com valor fora das opções mostra "(valor antigo)" selecionado', () => {
    const html = renderToStaticMarkup(
      React.createElement(RegistryMetaForm, {
        fields,
        values: { radar_modality: 'xpto' },
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('<option value="xpto" selected="">xpto (valor antigo)</option>');
  });
});

describe('ComexFieldDefsPanel · editor de opções', () => {
  it('parseOptionsText lê "valor=Rótulo" por linha', async () => {
    const { parseOptionsText } = await import('../components/modules/ComexFieldDefsPanel');
    expect(parseOptionsText('expressa=Expressa\n\n limitada_50k = Limitada até US$ 50 mil \nsolto')).toEqual([
      { value: 'expressa', label: 'Expressa' },
      { value: 'limitada_50k', label: 'Limitada até US$ 50 mil' },
      { value: 'solto', label: 'solto' },
    ]);
  });
});
