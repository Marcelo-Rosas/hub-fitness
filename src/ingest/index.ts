import { detectDomain, extractJsonValue, toResearchPack } from './parseResearchJson';
import { mapComexPack, mapComprasPack } from './mapPacks';
import type { IngestDomain, IngestParseResult, IngestPreviewRow } from './types';

export function parseResearchIngest(raw: string, forcedDomain?: IngestDomain): IngestParseResult {
  const pack = toResearchPack(extractJsonValue(raw));
  if (!pack.items.length) throw new Error('O pacote não tem items[].');
  const domain = detectDomain(pack, forcedDomain);
  const warnings: string[] = [];
  const skipped = [];
  const preview: IngestPreviewRow[] = [];

  if (domain === 'compras') {
    const meta = pack.research_meta as { account_code?: string } | undefined;
    const defaultAccountCode =
      (typeof meta?.account_code === 'string' && meta.account_code) ||
      (typeof pack.accounting_hint === 'string' ? pack.accounting_hint : undefined);
    const mapped = mapComprasPack(pack.items, { defaultAccountCode });
    skipped.push(...mapped.skipped);
    warnings.push(...mapped.warnings);
    for (const c of mapped.draft.companies) {
      preview.push({
        domain,
        action: 'insert',
        label: `${c.name} · ${c.state}`,
        detail: `${c.city} · ${c.freightType} · lead ${c.deliveryLeadTimeDays}d Itajaí`,
      });
    }
    for (const q of mapped.draft.quotes) {
      preview.push({
        domain,
        action: 'insert',
        label: q.productDescription,
        detail: `${q.supplierName} · R$ ${q.totalMonthlyWithFreight.toLocaleString('pt-BR')}/mês landed SC${q.isRecommendedWinner ? ' · vencedor' : ''}`,
      });
    }
    if (pack.example) {
      warnings.push(
        'Pacote example: true — não grava no cadastro. Preencha RFQ e remova a flag.',
      );
    }
    if (pack.rfq) {
      warnings.push(
        'Folha RFQ: preencher unit_price_brl + frete até Itajaí. CIF-SP não vence.',
      );
    }
    const zeroPrice = mapped.draft.quotes.filter((q) => q.unitPrice <= 0);
    if (zeroPrice.length > 0) {
      warnings.push(
        `${zeroPrice.length} cotação(ões) com preço 0 — RFQ incompleto, não aplicar.`,
      );
    }
    const paleteLote = mapped.draft.quotes.filter(
      (q) => q.materialCategory.startsWith('Paletes') && q.monthlyVolumeUnit >= 300,
    );
    if (paleteLote.length > 0) {
      warnings.push(
        'Palete com volume ≥300 parece lote inicial, não reposição mensal — não lançar assim no DRE.',
      );
    }
    return { domain, pack, compras: mapped.draft, preview, skipped, warnings };
  }

  const mapped = mapComexPack(pack.items);
  skipped.push(...mapped.skipped);
  for (const p of mapped.draft.processes) {
    preview.push({
      domain,
      action: 'insert',
      label: String(p.payload.ncm_code || p.code || 'processo'),
      detail: `${p.payload.client_name || p.client_slug || '—'} · ${p.payload.type}`,
    });
  }
  return { domain, pack, comex: mapped.draft, preview, skipped, warnings };
}

export { INGEST_DOMAINS } from './types';
export type { IngestDomain, IngestParseResult } from './types';
