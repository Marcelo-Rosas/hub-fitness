import { describe, it, expect } from 'vitest';
import { parseResearchIngest } from '../ingest';
import { mapCategory, resolveSupplierContactEmail } from '../ingest/mapPacks';
import rfqStretch from '../data/examples/compras-rfq-stretch.json';
import rfqPalete from '../data/examples/compras-rfq-palete.json';
import rfqEmpilhadeira from '../data/examples/compras-rfq-empilhadeira.json';
import researchFitas from '../data/examples/compras-research-fitas-pet.json';

const comprasPack = {
  domain: 'compras',
  items: [
    {
      category: 'Filme Stretch',
      item_name: 'Stretch 500mm 25µ',
      sku_spec: 'PEBD bobina 3.5kg',
      monthly_volume_hypothesis: { qty: 140, basis: 'hub SC' },
      recommended_for_hub_sc: { supplier_trade_name: 'Scheffer', reason: 'landed Itajaí' },
      suppliers: [
        {
          trade_name: 'MBB Polycamp',
          uf: 'SP',
          city: 'Sumaré',
          freight_type_quoted: 'CIF',
          freight_covers_itajai_sc: false,
          unit_price_brl: 42.5,
          shipping_cost_monthly_brl_to_itajai: 800,
          landed_cost_monthly_brl: 6750,
          lead_time_days_to_itajai: 6,
        },
        {
          trade_name: 'Scheffer',
          uf: 'PR',
          city: 'Ponta Grossa',
          freight_type_quoted: 'FOB',
          freight_covers_itajai_sc: true,
          unit_price_brl: 39.9,
          shipping_cost_monthly_brl_to_itajai: 450,
          landed_cost_monthly_brl: 6036,
          lead_time_days_to_itajai: 4,
        },
      ],
    },
  ],
};

describe('ingest Deep Research', () => {
  it('mapeia categorias do prompt AG', () => {
    expect(mapCategory('Locacao Empilhadeiras')).toBe('Locação Empilhadeiras');
    expect(mapCategory('Etiquetas WMS')).toBe('Etiquetas WMS');
    expect(mapCategory('EPIs')).toBe('EPIs');
  });

  it('extrai JSON de fence markdown', () => {
    const raw = 'blá\n```json\n' + JSON.stringify(comprasPack) + '\n```\n';
    const result = parseResearchIngest(raw);
    expect(result.domain).toBe('compras');
    expect(result.compras?.quotes).toHaveLength(2);
  });

  it('não elege CIF-SP como vencedor; Scheffer PR vence', () => {
    const result = parseResearchIngest(JSON.stringify(comprasPack));
    const winner = result.compras?.quotes.find((q) => q.isRecommendedWinner);
    expect(winner?.supplierState).toBe('PR');
    expect(winner?.supplierName).toContain('Scheffer');
    const sp = result.compras?.quotes.find((q) => q.supplierState === 'SP');
    expect(sp?.isRecommendedWinner).toBe(false);
    expect(sp?.shippingCostMonthly).toBe(800);
    expect(result.warnings.some((w) => w.includes('Itajaí'))).toBe(true);
  });

  it('pula UF fora do eixo', () => {
    const result = parseResearchIngest(
      JSON.stringify({
        domain: 'compras',
        items: [
          {
            category: 'EPIs',
            item_name: 'Capacete',
            suppliers: [{ trade_name: 'Acme RS', uf: 'RS', unit_price_brl: 10 }],
          },
        ],
      }),
    );
    expect(result.compras?.companies).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/eixo SP\/PR\/SC/);
  });

  it('mapeia processos comex por NCM', () => {
    const result = parseResearchIngest(
      JSON.stringify({
        domain: 'comex',
        items: [
          {
            code: 'IMP-1',
            ncm_code: '9506.91.00',
            client_name: 'Impulse Fitness',
            type: 'importacao',
            fob_usd: 120000,
          },
        ],
      }),
    );
    expect(result.domain).toBe('comex');
    expect(result.comex?.processes[0].payload.ncm_code).toBe('9506.91.00');
  });

  it('marca pacote de clone como example e não como carga', () => {
    const result = parseResearchIngest(
      JSON.stringify({
        domain: 'compras',
        example: true,
        items: [
          {
            category: 'Filme Stretch',
            item_name: 'Exemplo',
            suppliers: [{ trade_name: 'Fort Plast', uf: 'SC', unit_price_brl: 0 }],
          },
        ],
      }),
    );
    expect(result.pack.example).toBe(true);
  });

  it('folha RFQ stretch parseia Fort Plast e Teckplast com preço 0 e rfq', () => {
    const result = parseResearchIngest(
      JSON.stringify({
        domain: 'compras',
        example: true,
        rfq: true,
        items: [
          {
            category: 'Filme Stretch',
            item_name: 'Filme Stretch PEBD Manual 500 mm',
            monthly_volume_hypothesis: { qty: 150 },
            suppliers: [
              { trade_name: 'Fort Plast', uf: 'SC', city: 'Palhoça', unit_price_brl: 0, price_type: 'rfq' },
              { trade_name: 'Teckplast', uf: 'SC', city: 'Jaraguá do Sul', unit_price_brl: 0, price_type: 'rfq' },
            ],
          },
        ],
      }),
    );
    expect(result.pack.rfq).toBe(true);
    expect(result.compras?.companies).toHaveLength(2);
    expect(result.compras?.quotes.every((q) => q.unitPrice === 0)).toBe(true);
    expect(result.warnings.some((w) => w.includes('preço 0'))).toBe(true);
  });

  it('folha RFQ palete parseia Águia+Ecopack e não usa lote 300 como volume mensal', () => {
    const result = parseResearchIngest(JSON.stringify(rfqPalete));
    expect(result.pack.rfq).toBe(true);
    expect(result.compras?.companies.map((c) => c.name)).toEqual(['Águia Pallets', 'Ecopack']);
    expect(result.compras?.quotes.every((q) => q.monthlyVolumeUnit < 300)).toBe(true);
    expect(result.warnings.some((w) => w.includes('volume ≥300'))).toBe(false);
  });

  it('alerta palete com volume 300 como lote inicial', () => {
    const result = parseResearchIngest(
      JSON.stringify({
        domain: 'compras',
        items: [
          {
            category: 'Paletes PBR HT / Plastico',
            item_name: 'PBR HT',
            monthly_volume_hypothesis: { qty: 300, basis: 'lote' },
            suppliers: [{ trade_name: 'Águia Pallets', uf: 'SC', unit_price_brl: 50 }],
          },
        ],
      }),
    );
    expect(result.warnings.some((w) => w.includes('lote inicial'))).toBe(true);
  });

  it('folha RFQ empilhadeira parseia Rioita+GV com 2 equipamentos e preço 0', () => {
    const result = parseResearchIngest(JSON.stringify(rfqEmpilhadeira));
    expect(result.pack.rfq).toBe(true);
    expect(result.compras?.companies.map((c) => c.name)).toEqual(['Rioita Empilhadeiras', 'GV Logística']);
    expect(result.compras?.quotes.every((q) => q.monthlyVolumeUnit === 2 && q.unitPrice === 0)).toBe(true);
  });

  it('folha RFQ stretch do arquivo marca rfq e dois SC', () => {
    const result = parseResearchIngest(JSON.stringify(rfqStretch));
    expect(result.pack.rfq).toBe(true);
    expect(result.compras?.companies).toHaveLength(2);
    expect(result.compras?.companies.every((c) => c.state === 'SC')).toBe(true);
  });

  it('pesquisa Fitas PET e ingest sem e-mail sempre geram contactEmail', () => {
    const withEmail = parseResearchIngest(JSON.stringify(researchFitas));
    expect(withEmail.compras?.companies.every((c) => Boolean(c.contactEmail?.includes('@')))).toBe(true);

    const noEmail = parseResearchIngest(
      JSON.stringify({
        domain: 'compras',
        items: [
          {
            category: 'Fitas PET',
            item_name: 'Fita PET',
            suppliers: [{ trade_name: 'Sem Mail Ltda', uf: 'SC', unit_price_brl: 10 }],
          },
        ],
      }),
    );
    expect(noEmail.compras?.companies[0]?.contactEmail).toMatch(/@/);
    expect(resolveSupplierContactEmail({ id: 'x', name: 'Y', contactEmail: '' })).toMatch(/@/);
  });
});
