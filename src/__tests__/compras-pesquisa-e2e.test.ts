import { describe, it, expect } from 'vitest';
import { parseResearchIngest } from '../ingest';
import { mapCategory, normalizeComprasItems } from '../ingest/mapPacks';
import { clampComprasResearchPack, materialCategoryHint, buildCoaResearchPrompt } from '../core/compras/researchFromCoa';
import { PLANO_DE_CONTAS_ITEMS } from '../data/planoDeContasData';

const geminiQuotesPack = {
  domain: 'compras',
  accounting_hint: '5.1.01.03',
  items: [
    {
      category: 'Fitas PET',
      item_category: 'Fitas de Arquear PET',
      specification: 'Fita PET 16mm',
      monthly_volume_hypothesis: { qty: 1, historical_data: false, status: 'sem_dados_historicos' },
      quotes: [
        {
          supplier_name: 'Banderpack Embalagens',
          origin_city_state: 'Joinville / SC',
          unit_price_brl: 192,
          freight_type: 'FOB',
          freight_cost_brl: 11.5,
          icms_rate_pct: 12,
          landed_cost_unit_brl: 0,
          lead_time_days: 3,
          source_citable: 'Tabela Banderpack SC',
        },
        {
          supplier_name: 'Cyklop do Brasil',
          origin_city_state: 'Itupeva / SP',
          unit_price_brl: 208,
          freight_type: 'CIF',
          freight_cost_brl: 0,
          icms_rate_pct: 12,
          landed_cost_unit_brl: 0,
          lead_time_days: 5,
          source_citable: 'Catálogo Cyklop',
        },
        {
          supplier_name: 'Cantopack',
          origin_city_state: 'Araquari / SC',
          unit_price_brl: 199,
          freight_type: 'CIF',
          freight_cost_brl: 0,
          icms_rate_pct: 12,
          landed_cost_unit_brl: 0,
          lead_time_days: 4,
        },
        {
          supplier_name: 'Extra Pack (deve ser cortado)',
          origin_city_state: 'Curitiba / PR',
          unit_price_brl: 99,
          freight_type: 'FOB',
          freight_cost_brl: 5,
          icms_rate_pct: 12,
          landed_cost_unit_brl: 104,
          lead_time_days: 4,
        },
      ],
    },
  ],
};

describe('CoA hint 1 conta = 1 insumo', () => {
  it('mapeia códigos granulares (sem bag)', () => {
    expect(materialCategoryHint('5.1.01.01')).toBe('Filme Stretch');
    expect(materialCategoryHint('5.1.01.02')).toBe('Plástico Bolha');
    expect(materialCategoryHint('5.1.01.03')).toBe('Fitas PET');
    expect(materialCategoryHint('5.1.01.04')).toBe('Cantoneiras');
    expect(materialCategoryHint('5.1.01.05')).toBe('Etiquetas WMS');
    expect(materialCategoryHint('5.1.01.06')).toBe('Ribbons');
    expect(materialCategoryHint('5.1.01.07')).toBe('Fita Lacre');
    expect(materialCategoryHint('5.1.01.08')).toBe('EPIs');
    expect(materialCategoryHint('5.1.01.09')).toBe('Uniformes');
    expect(materialCategoryHint('5.1.01.10')).toBe('Paletes PBR HT Madeira');
    expect(materialCategoryHint('5.1.01.11')).toBe('Paletes Plástico PEAD');
    expect(materialCategoryHint('5.1.05.01')).toBe('Locação Empilhadeiras');
  });

  it('prompt volume = script sem_dados_historicos (sem narrativa basis)', () => {
    const account = PLANO_DE_CONTAS_ITEMS.find((a) => a.code === '5.1.01.03');
    expect(account).toBeTruthy();
    const prompt = buildCoaResearchPrompt({ account: account! });
    expect(prompt).toContain('sem_dados_historicos');
    expect(prompt).toContain('"historical_data": false');
    expect(prompt).not.toContain('Documentar basis');
    expect(prompt).toContain('Proibido campo "basis"');
  });
});

describe('E2E ingest · schema Gemini fitas (5.1.01.03)', () => {
  it('normaliza item_category + quotes[] → suppliers[]', () => {
    const norm = normalizeComprasItems(geminiQuotesPack.items as never);
    expect(norm[0].suppliers?.length).toBe(4);
    expect(norm[0].suppliers?.[0].uf).toBe('SC');
    expect(mapCategory(norm[0].category)).toBe('Fitas PET');
  });

  it('clampComprasResearchPack corta para exatamente 3 cotações', () => {
    const clamped = clampComprasResearchPack(geminiQuotesPack as never, 3);
    const items = clamped.items as { quotes?: unknown[] }[];
    expect(items).toHaveLength(1);
    expect(items[0].quotes).toHaveLength(3);
  });

  it('ingest propaga accountCode do accounting_hint', () => {
    const result = parseResearchIngest(JSON.stringify(geminiQuotesPack), 'compras');
    expect(result.compras?.quotes.every((q) => q.accountCode === '5.1.01.03')).toBe(true);
  });

  it('landed_cost 0 não zera custo total (unit×volume+frete)', () => {
    const clamped = clampComprasResearchPack(geminiQuotesPack as never, 3);
    const result = parseResearchIngest(JSON.stringify(clamped), 'compras');
    expect(result.compras?.quotes.length).toBe(3);
    expect(result.compras?.quotes.every((q) => q.materialCategory === 'Fitas PET')).toBe(true);
    expect(result.compras?.quotes.every((q) => q.totalMonthlyWithFreight > 0)).toBe(true);
    expect(result.compras?.quotes[0].deliveryLeadTimeDays).toBeGreaterThan(0);
    expect(result.compras?.quotes[0].volumeBasis).toBeUndefined();
    expect(result.compras?.quotes[0].monthlyVolumeUnit).toBe(1);
    const band = result.compras?.quotes.find((q) => q.supplierName.includes('Banderpack'));
    expect(band?.totalMonthlyWithFreight).toBeCloseTo(192 * 1 + 11.5, 1);
  });

  it('clamp NÃO mistura SKUs de items diferentes (ex.: Stretch+Locação)', () => {
    const mixed = {
      domain: 'compras',
      items: [
        {
          category: 'Filme Stretch',
          item_name: 'Filme Stretch',
          suppliers: [{ trade_name: 'Fort Plast', uf: 'SC', unit_price_brl: 1 }],
        },
        {
          category: 'Locacao Empilhadeiras',
          item_name: 'Locação Full-Service Retrátil Elétrica',
          suppliers: [
            { trade_name: 'Águia', uf: 'SC', unit_price_brl: 0 },
            { trade_name: 'GV', uf: 'SC', unit_price_brl: 0 },
          ],
        },
      ],
    };
    const clamped = clampComprasResearchPack(mixed as never, 3);
    const items = clamped.items as { item_name?: string; suppliers?: unknown[] }[];
    expect(items).toHaveLength(1);
    expect(items[0].item_name).toBe('Filme Stretch');
    expect(items[0].suppliers).toHaveLength(1);
  });
});

describe('E2E live API · compras-research 5.1.01.03', () => {
  it(
    'POST /api/gemini/compras-research → exatamente 3 cotações Fitas PET',
    async () => {
      const res = await fetch('http://127.0.0.1:3000/api/gemini/compras-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountCode: '5.1.01.03' }),
      });
      expect(res.ok).toBe(true);
      const json = (await res.json()) as {
        success: boolean;
        pack?: { domain?: string; items?: unknown[] };
      };
      expect(json.success).toBe(true);
      const parsed = parseResearchIngest(JSON.stringify(json.pack), 'compras');
      expect(parsed.compras?.quotes.length).toBe(3);
      expect(parsed.compras?.quotes.every((q) => q.materialCategory === 'Fitas PET')).toBe(true);
      expect(parsed.compras?.quotes.every((q) => q.accountCode === '5.1.01.03')).toBe(true);
      expect(parsed.compras?.quotes.every((q) => q.unitPrice > 0)).toBe(true);
      expect(parsed.compras?.quotes.every((q) => q.totalMonthlyWithFreight > 0)).toBe(true);
      expect(
        parsed.compras?.quotes.every(
          (q) =>
            /fita|pet|arquear/i.test(q.productDescription) &&
            !/loca[cç][aã]o|empilh|retr[aá]til/i.test(q.productDescription),
        ),
      ).toBe(true);
    },
    120_000,
  );
});
