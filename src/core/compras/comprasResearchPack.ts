import { accountByCode, clampComprasResearchPack, materialCategoryHint } from './researchFromCoa';
import comprasExamplePack from '../../data/examples/compras-deep-research.example.json';
import comprasRfqStretch from '../../data/examples/compras-rfq-stretch.json';
import comprasRfqPalete from '../../data/examples/compras-rfq-palete.json';
import comprasRfqEmpilhadeira from '../../data/examples/compras-rfq-empilhadeira.json';
import comprasResearchFitasPet from '../../data/examples/compras-research-fitas-pet.json';

/** CoA manda na categoria — evita Locação/Stretch cair como Fitas PET. */
export function finalizeComprasResearchPack(
  accountCode: string,
  pack: Record<string, unknown>,
  maxQuotes = 3,
): Record<string, unknown> {
  const category = materialCategoryHint(accountCode);
  const taggedItems = Array.isArray(pack.items)
    ? (pack.items as Record<string, unknown>[]).map((it) => ({
        ...it,
        category,
        accounting_hint: accountCode,
      }))
    : pack.items;
  return clampComprasResearchPack({ ...pack, items: taggedItems }, maxQuotes);
}

/** Fallback quando Gemini ausente/falha — mesma folha que a rota HTTP. */
export function pickComprasResearchFallback(
  accountCode: string,
  amplifyNote?: string,
): Record<string, unknown> {
  const account = accountByCode(accountCode);
  const wrap = (pack: Record<string, unknown>) =>
    finalizeComprasResearchPack(accountCode, {
      ...pack,
      example: pack.example === true,
      research_meta: {
        account_code: accountCode,
        account_name: account?.name ?? '',
        note: 'Fallback offline/simulado — configure GEMINI_API_KEY para pesquisa live.',
        amplify: amplifyNote || null,
      },
    });

  if (accountCode.startsWith('5.1.01.01')) return wrap(comprasRfqStretch as Record<string, unknown>);
  if (accountCode === '5.1.01.03') return wrap(comprasResearchFitasPet as Record<string, unknown>);
  if (accountCode === '5.1.01.10' || accountCode === '5.1.01.11') {
    return wrap(comprasRfqPalete as Record<string, unknown>);
  }
  if (accountCode.startsWith('5.1.05') || accountCode.includes('empilh') || accountCode.startsWith('5.1.02')) {
    return wrap(comprasRfqEmpilhadeira as Record<string, unknown>);
  }
  if (accountCode.includes('palete')) return wrap(comprasRfqPalete as Record<string, unknown>);
  const first = Array.isArray((comprasExamplePack as { items?: unknown[] }).items)
    ? [(comprasExamplePack as { items: Record<string, unknown>[] }).items[0]]
    : [];
  return wrap({ ...(comprasExamplePack as Record<string, unknown>), items: first });
}
