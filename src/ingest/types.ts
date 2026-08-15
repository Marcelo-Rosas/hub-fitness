export type IngestDomain = 'compras' | 'comex';

export const INGEST_DOMAINS: { id: IngestDomain; label: string; module: string }[] = [
  { id: 'compras', label: 'Compras · fornecedores e cotações', module: 'M10' },
  { id: 'comex', label: 'Comex · processos / NCM', module: 'M18' },
];

export interface ResearchSupplier {
  legal_name?: string;
  trade_name?: string;
  cnpj?: string;
  city?: string;
  uf?: string;
  website?: string;
  phone?: string;
  email?: string;
  specialty?: string;
  freight_type_quoted?: string;
  freight_covers_itajai_sc?: boolean;
  lead_time_days_to_itajai?: number;
  payment_terms?: string;
  icms_rate_pct?: number;
  unit_price_brl?: number;
  price_date?: string;
  price_type?: string;
  shipping_cost_monthly_brl_to_itajai?: number;
  landed_cost_monthly_brl?: number;
  moq?: string;
  notes?: string;
  sources?: string[];
}

export interface ResearchItem {
  category?: string;
  item_name?: string;
  sku_spec?: string;
  unit_of_measure?: string;
  monthly_volume_hypothesis?: {
    qty?: number;
    /** @deprecated narrativa inventada — não usar na UI */
    basis?: string;
    historical_data?: boolean;
    status?: 'sem_dados_historicos' | string;
  };
  suppliers?: ResearchSupplier[];
  recommended_for_hub_sc?: {
    supplier_trade_name?: string;
    reason?: string;
    discarded_sp_cif_trap?: boolean | string;
  };
  accounting_hint?: string;
  risks?: string;
  // comex
  code?: string;
  ncm?: string;
  ncm_code?: string;
  client_slug?: string;
  client_name?: string;
  type?: string;
  declaration_number?: string;
  fob_usd?: number;
  cif_brl?: number;
  [key: string]: unknown;
}

export interface ResearchPack {
  domain?: IngestDomain | string;
  example?: boolean;
  rfq?: boolean;
  example_note?: string;
  rfq_brief?: string;
  accounting_hint?: string;
  research_meta?: { account_code?: string; [key: string]: unknown };
  items: ResearchItem[];
}

export interface IngestSkip {
  reason: string;
  ref: string;
}

export interface IngestPreviewRow {
  domain: IngestDomain;
  action: 'insert' | 'update';
  label: string;
  detail: string;
}

export interface ComprasIngestDraft {
  companies: import('../types').SupplierCompany[];
  quotes: import('../types').SupplierQuote[];
}

export interface ComexIngestDraft {
  processes: Array<{
    code?: string;
    client_slug: string | null;
    payload: Record<string, unknown>;
  }>;
}

export interface IngestParseResult {
  domain: IngestDomain;
  pack: ResearchPack;
  compras?: ComprasIngestDraft;
  comex?: ComexIngestDraft;
  preview: IngestPreviewRow[];
  skipped: IngestSkip[];
  warnings: string[];
}
