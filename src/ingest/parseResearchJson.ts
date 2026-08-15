import type { IngestDomain, ResearchItem, ResearchPack } from './types';

/** Extrai o primeiro objeto/array JSON de texto (inclui fence markdown). */
export function extractJsonValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Cole o JSON do Deep Research (ou solte um arquivo .json).');

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const startObj = candidate.indexOf('{');
    const startArr = candidate.indexOf('[');
    const start =
      startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);
    if (start < 0) throw new Error('Não achei JSON válido no texto colado.');
    const slice = candidate.slice(start);
    try {
      return JSON.parse(slice);
    } catch {
      throw new Error('JSON inválido. Confira vírgulas e aspas do pacote Deep Research.');
    }
  }
}

export function toResearchPack(value: unknown): ResearchPack {
  if (Array.isArray(value)) {
    return { items: value as ResearchItem[] };
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      const meta =
        obj.research_meta && typeof obj.research_meta === 'object'
          ? (obj.research_meta as ResearchPack['research_meta'])
          : undefined;
      return {
        domain: typeof obj.domain === 'string' ? obj.domain : undefined,
        example: obj.example === true,
        rfq: obj.rfq === true,
        example_note: typeof obj.example_note === 'string' ? obj.example_note : undefined,
        rfq_brief: typeof obj.rfq_brief === 'string' ? obj.rfq_brief : undefined,
        accounting_hint: typeof obj.accounting_hint === 'string' ? obj.accounting_hint : undefined,
        research_meta: meta,
        items: obj.items as ResearchItem[],
      };
    }
    // objeto único
    return { items: [obj as ResearchItem] };
  }
  throw new Error('O pacote precisa ser { items: [...] } ou um array.');
}

export function detectDomain(pack: ResearchPack, forced?: IngestDomain): IngestDomain {
  if (forced) return forced;
  const declared = String(pack.domain || '').toLowerCase();
  if (declared === 'compras' || declared === 'comex') return declared;
  const items = pack.items || [];
  const hasSuppliers = items.some((i) => Array.isArray(i.suppliers) && i.suppliers.length > 0);
  const hasNcm = items.some((i) => i.ncm || i.ncm_code || i.declaration_number);
  if (hasSuppliers && !hasNcm) return 'compras';
  if (hasNcm && !hasSuppliers) return 'comex';
  if (hasSuppliers) return 'compras';
  throw new Error('Não deu para detectar o domínio. Use "domain": "compras" ou "comex" no JSON.');
}
