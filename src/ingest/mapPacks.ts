import type { MaterialCategory, SupplierCompany, SupplierQuote, SupplierState } from '../types';
import type {
  ComexIngestDraft,
  ComprasIngestDraft,
  IngestSkip,
  ResearchItem,
  ResearchSupplier,
} from './types';

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'item'
  );
}

/** E-mail cadastral ou placeholder RFQ (API intranet exige supplier_email). */
export function resolveSupplierContactEmail(company: {
  id?: string;
  name?: string;
  contactEmail?: string | null;
}): string {
  const existing = company.contactEmail?.trim();
  if (existing) return existing;
  const slug =
    slugify(company.id || '') !== 'item'
      ? slugify(company.id || '')
      : slugify(company.name || 'fornecedor');
  return `comercial@${slug}.rfq.hubfitness.local`;
}

export function mapCategory(raw?: string): MaterialCategory {
  const n = (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (n.includes('stretch')) return 'Filme Stretch';
  if (n.includes('bolha')) return 'Plástico Bolha';
  if (n.includes('palete') && (n.includes('pead') || n.includes('plast'))) return 'Paletes Plástico PEAD';
  if (n.includes('palete') || n.includes('pallet')) return 'Paletes PBR HT Madeira';
  if (n.includes('empilh')) return 'Locação Empilhadeiras';
  if (n.includes('fita') && n.includes('cantone')) return 'Fitas & Cantoneiras';
  if (n.includes('cantone')) return 'Cantoneiras';
  if (n.includes('lacre')) return 'Fita Lacre';
  if (n.includes('ribbon')) return 'Ribbons';
  if (n.includes('fita') || n.includes('amarra')) return 'Fitas PET';
  if (n.includes('energia') || n.includes('bateria')) return 'Energia Trifásica / Baterias';
  if (n.includes('etiqueta') || n.includes('wms') || n.includes('zebra')) return 'Etiquetas WMS';
  if (n.includes('uniforme')) return 'Uniformes';
  if (n.includes('epi')) return 'EPIs';
  return 'Outros AG';
}

function positiveNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function mapState(uf?: string): SupplierState | null {
  const u = (uf || '').trim().toUpperCase();
  if (u === 'SP' || u === 'PR' || u === 'SC') return u;
  return null;
}

function freightType(raw?: string): 'CIF' | 'FOB' {
  return String(raw || '').toUpperCase().includes('FOB') ? 'FOB' : 'CIF';
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function supplierDisplayName(s: ResearchSupplier): string {
  return (s.trade_name || s.legal_name || '').trim();
}

function parseCityState(raw?: string): { city: string; uf: string } {
  const t = String(raw || '').trim();
  const m = t.match(/^(.+?)\s*[/,-]\s*([A-Za-z]{2})\s*$/);
  if (m) return { city: m[1].trim(), uf: m[2].toUpperCase() };
  const parts = t.split(/\s+/);
  const maybeUf = parts[parts.length - 1]?.toUpperCase();
  if (maybeUf && /^(SP|PR|SC)$/.test(maybeUf)) {
    return { city: parts.slice(0, -1).join(' '), uf: maybeUf };
  }
  return { city: t, uf: '' };
}

/**
 * Aceita schemas canônico e variantes Gemini:
 * - suppliers[]
 * - quotes[] + supplier_name + origin_city_state
 * - companies[] + quote{} + origin
 */
export function normalizeComprasItems(items: ResearchItem[]): ResearchItem[] {
  return items.map((item) => {
    const category =
      item.category ||
      (typeof item.item_category === 'string' ? item.item_category : undefined) ||
      (typeof item.product_category === 'string' ? item.product_category : undefined) ||
      (typeof item.description === 'string' ? item.description : undefined) ||
      (typeof item.application === 'string' ? item.application : undefined);
    const item_name =
      item.item_name ||
      (typeof item.item_category === 'string' ? item.item_category : undefined) ||
      (typeof item.description === 'string' ? item.description : undefined) ||
      category;
    const sku_spec =
      item.sku_spec ||
      (typeof item.specification === 'string' ? item.specification : undefined) ||
      (typeof item.application === 'string' ? item.application : undefined);

    const existing = item.suppliers;
    if (Array.isArray(existing) && existing.length > 0) {
      return { ...item, category, item_name, sku_spec, suppliers: existing };
    }

    const fromQuotes = Array.isArray(item.quotes) ? item.quotes : [];
    const fromCompanies = Array.isArray(item.companies) ? item.companies : [];
    const altRows = fromQuotes.length > 0 ? fromQuotes : fromCompanies;

    const suppliers: ResearchSupplier[] = altRows
      .map((q) => {
        if (!q || typeof q !== 'object') return null;
        const row = q as Record<string, unknown>;
        const nested =
          row.quote && typeof row.quote === 'object'
            ? (row.quote as Record<string, unknown>)
            : null;
        const name = String(
          row.supplier_name || row.trade_name || row.legal_name || row.name || '',
        ).trim();
        if (!name) return null;
        const { city, uf } = parseCityState(
          String(
            row.origin_city_state ||
              row.city_state ||
              row.origin ||
              row.city ||
              nested?.origin ||
              '',
          ),
        );
        const ufRaw = String(row.uf || uf || '').toUpperCase();
        const unit = num(
          nested?.unit_price_brl ?? row.unit_price_brl ?? row.unit_price,
          0,
        );
        const freightUnit = num(
          nested?.freight_cost_brl ??
            row.freight_cost_brl ??
            row.shipping_cost_monthly_brl_to_itajai,
          0,
        );
        const landedUnit = positiveNum(
          nested?.landed_cost_unit_brl ?? row.landed_cost_unit_brl,
          unit + freightUnit,
        );
        const volume = Math.max(1, num(item.monthly_volume_hypothesis?.qty, 1));
        const freightTypeRaw = String(
          nested?.incoterm ||
            nested?.freight_type ||
            row.freight_type ||
            row.freight_type_quoted ||
            'FOB',
        );
        return {
          trade_name: name,
          legal_name: name,
          city: city || String(row.city || ''),
          uf: ufRaw,
          freight_type_quoted: freightTypeRaw,
          freight_covers_itajai_sc: freightTypeRaw.toUpperCase().includes('CIF'),
          lead_time_days_to_itajai: num(
            nested?.lead_time_days ?? row.lead_time_days ?? row.lead_time_days_to_itajai,
            5,
          ),
          icms_rate_pct: num(
            nested?.icms_origin_rate ?? nested?.icms_rate_pct ?? row.icms_rate_pct,
            12,
          ),
          unit_price_brl: unit,
          shipping_cost_monthly_brl_to_itajai: freightUnit * volume,
          landed_cost_monthly_brl: landedUnit * volume,
          notes: String(row.notes || nested?.notes || ''),
          sources: nested?.source_citable
            ? [String(nested.source_citable)]
            : row.source_citable
              ? [String(row.source_citable)]
              : Array.isArray(row.sources)
                ? (row.sources as string[])
                : [],
          price_type: row.example === true || nested?.example === true ? 'estimativa' : 'pesquisa',
          cnpj: row.cnpj ? String(row.cnpj) : undefined,
        } as ResearchSupplier;
      })
      .filter((s): s is ResearchSupplier => Boolean(s));

    return { ...item, category, item_name, sku_spec, suppliers };
  });
}

export function mapComprasPack(
  items: ResearchItem[],
  opts?: { defaultAccountCode?: string },
): {
  draft: ComprasIngestDraft;
  skipped: IngestSkip[];
  warnings: string[];
} {
  const companiesByKey = new Map<string, SupplierCompany>();
  const quotes: SupplierQuote[] = [];
  const skipped: IngestSkip[] = [];
  const warnings: string[] = [];

  for (const item of normalizeComprasItems(items)) {
    const category = mapCategory(item.category);
    const accountCode =
      String(item.accounting_hint || opts?.defaultAccountCode || '').trim() || undefined;
    const desc = [item.item_name, item.sku_spec].filter(Boolean).join(' · ') || 'Item AG';
    const hyp = item.monthly_volume_hypothesis;
    // HUB sem histórico de compras: qty placeholder; nunca persistir narrativa `basis`.
    const volume = Math.max(1, num(hyp?.qty, 1));
    const recName = (item.recommended_for_hub_sc?.supplier_trade_name || '').trim().toLowerCase();
    const suppliers = item.suppliers || [];
    if (!suppliers.length) {
      skipped.push({ reason: 'Item sem suppliers[] / quotes[]', ref: desc });
      continue;
    }

    for (const s of suppliers) {
      const name = supplierDisplayName(s);
      const state = mapState(s.uf);
      if (!name) {
        skipped.push({ reason: 'Fornecedor sem nome', ref: desc });
        continue;
      }
      if (!state) {
        skipped.push({
          reason: `UF ${s.uf || '?'} fora do eixo SP/PR/SC (ADR destino Itajaí)`,
          ref: name,
        });
        continue;
      }

      const key = `${slugify(name)}|${state}`;
      if (!companiesByKey.has(key)) {
        companiesByKey.set(key, {
          id: `sup-ingest-${slugify(name)}-${state.toLowerCase()}`,
          name,
          state,
          city: (s.city || '').trim() || `${state}`,
          specialty: (s.specialty || item.category || category).trim(),
          rating: 4.5,
          deliveryLeadTimeDays: Math.max(1, Math.round(num(s.lead_time_days_to_itajai, 5))),
          freightType: freightType(s.freight_type_quoted),
          paymentTerms: s.payment_terms || '30 / 60 dias',
          icmsTaxRate: num(s.icms_rate_pct, state === 'SP' ? 12 : 12),
          contactPhone: s.phone || '',
          contactEmail: resolveSupplierContactEmail({
            id: `sup-ingest-${slugify(name)}-${state.toLowerCase()}`,
            name,
            contactEmail: s.email || '',
          }),
          cnpj: s.cnpj,
          website: s.website,
        });
      }
      const company = companiesByKey.get(key)!;

      if (s.freight_covers_itajai_sc === false && state === 'SP') {
        warnings.push(
          `${name} (SP): CIF não cobre Itajaí/SC — landed usa frete informado até o Galpão A.`,
        );
      }

      const unit = num(s.unit_price_brl, 0);
      const ship = num(s.shipping_cost_monthly_brl_to_itajai, 0);
      const total = unit * volume;
      const computedLanded = total + ship;
      const rawLanded = s.landed_cost_monthly_brl;
      const landed = positiveNum(rawLanded, computedLanded);
      const leadDays = Math.max(1, Math.round(num(s.lead_time_days_to_itajai, company.deliveryLeadTimeDays || 5)));
      const isWinner =
        recName.length > 0 &&
        (name.toLowerCase().includes(recName) || recName.includes(name.toLowerCase())) &&
        !(s.freight_covers_itajai_sc === false && state === 'SP');

      const sourceNote = (s.sources || []).slice(0, 2).join(' ');
      quotes.push({
        id: `q-ingest-${slugify(name)}-${slugify(desc)}-${state.toLowerCase()}`,
        supplierId: company.id,
        supplierName: `${name} (${state})`,
        supplierState: state,
        materialCategory: category,
        accountCode,
        productDescription: desc,
        unitPrice: unit,
        monthlyVolumeUnit: volume,
        volumeBasis: undefined,
        totalMonthlyCost: total,
        shippingCostMonthly: ship,
        totalMonthlyWithFreight: landed,
        deliveryLeadTimeDays: leadDays,
        score: isWinner ? 92 : state === 'SC' ? 86 : 80,
        isRecommendedWinner: isWinner,
        notes: [
          s.notes,
          s.price_type ? `preço: ${s.price_type}` : '',
          s.price_date ? `ref ${s.price_date}` : '',
          item.recommended_for_hub_sc?.reason,
          sourceNote,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  return {
    draft: { companies: [...companiesByKey.values()], quotes },
    skipped,
    warnings,
  };
}

export function mapComexPack(items: ResearchItem[]): {
  draft: ComexIngestDraft;
  skipped: IngestSkip[];
} {
  const processes: ComexIngestDraft['processes'] = [];
  const skipped: IngestSkip[] = [];

  for (const item of items) {
    const ncm = String(item.ncm_code || item.ncm || '').trim();
    const client = String(item.client_name || item.client_slug || '').trim();
    if (!ncm && !item.code && !item.declaration_number) {
      skipped.push({
        reason: 'Processo sem NCM/código/declaração',
        ref: JSON.stringify(item).slice(0, 80),
      });
      continue;
    }
    const type = String(item.type || 'importacao').toLowerCase().includes('exp')
      ? 'exportacao'
      : 'importacao';
    processes.push({
      code: item.code ? String(item.code) : undefined,
      client_slug: item.client_slug ? String(item.client_slug) : null,
      payload: {
        client_name: client || item.client_slug || '',
        type,
        ncm_code: ncm,
        declaration_number: item.declaration_number || '',
        fob_usd: num(item.fob_usd),
        cif_brl: num(item.cif_brl),
        status: 'documentos_indexados',
      },
    });
  }

  return { draft: { processes }, skipped };
}
