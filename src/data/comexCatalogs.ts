import type { ComexEnumOption } from '../types/comex';

/** Catálogos de UI — opções de dropdown, não colunas de schema. */

export const COMEX_CLIENT_CATALOG: ComexEnumOption[] = [
  { value: 'Impulse Fitness', label: 'Impulse Fitness (importador)' },
  { value: 'Konnen', label: 'Konnen (Client #0 dogfood)' },
  { value: 'Stone Fitness', label: 'Stone Fitness' },
];

export const COMEX_NCM_CATALOG: ComexEnumOption[] = [
  { value: '9506.91.00', label: '9506.91.00 — Aparelhos de cultura física / ginástica' },
  { value: '9506.99.00', label: '9506.99.00 — Outros artigos para desporto' },
  { value: '9506.11.00', label: '9506.11.00 — Esquis' },
  { value: '9506.19.00', label: '9506.19.00 — Outros esquis e equipamentos' },
  { value: '9506.21.00', label: '9506.21.00 — Pranchas à vela' },
  { value: '9506.29.00', label: '9506.29.00 — Outros para esqui aquático / surf' },
  { value: '9506.31.00', label: '9506.31.00 — Tacos de golfe' },
  { value: '9506.32.00', label: '9506.32.00 — Bolas de golfe' },
  { value: '9506.39.00', label: '9506.39.00 — Outros artigos de golfe' },
  { value: '9506.40.00', label: '9506.40.00 — Artigos para tênis de mesa' },
  { value: '9506.51.00', label: '9506.51.00 — Raquetes de tênis' },
  { value: '9506.59.00', label: '9506.59.00 — Outras raquetes' },
  { value: '9506.61.00', label: '9506.61.00 — Bolas de tênis' },
  { value: '9506.62.00', label: '9506.62.00 — Bolas infláveis' },
  { value: '9506.69.00', label: '9506.69.00 — Outras bolas' },
  { value: '9506.70.00', label: '9506.70.00 — Patins' },
];

export const COMEX_CUSTOMS_CATALOG: ComexEnumOption[] = [
  { value: '0817600 - URF Navegantes / Itajaí', label: '0817600 — URF Navegantes / Itajaí' },
  { value: '0817700 - URF Itapoá', label: '0817700 — URF Itapoá' },
  { value: '0817800 - URF Itajaí', label: '0817800 — URF Itajaí' },
  { value: '0817200 - URF São Francisco do Sul', label: '0817200 — URF São Francisco do Sul' },
  { value: '0817100 - ALF Santos', label: '0817100 — ALF Santos' },
  { value: '0817300 - URF Paranaguá', label: '0817300 — URF Paranaguá' },
];

export const COMEX_STATUS_CATALOG: ComexEnumOption[] = [
  { value: 'documentos_indexados', label: 'Documentos indexados' },
  { value: 'aguardando_di', label: 'Aguardando DI / DUIMP' },
  { value: 'duimp_registrada', label: 'DUIMP registrada' },
  { value: 'due_emitida', label: 'DU-E emitida' },
  { value: 'conferencia', label: 'Conferência aduaneira' },
  { value: 'desembaracado', label: 'Desembaraçado' },
  { value: 'armazenado', label: 'Armazenado no hub' },
];

export const COMEX_PUCOMEX_STATUS_CATALOG: ComexEnumOption[] = [
  { value: 'Aguardando declaração', label: 'Aguardando declaração' },
  { value: 'Consultado no Portal', label: 'Consultado no Portal' },
  { value: 'Integrado e Validador OK', label: 'Integrado e Validador OK' },
  { value: 'Falha na consulta', label: 'Falha na consulta' },
];

export const COMEX_DUIMP_VERSION_CATALOG: ComexEnumOption[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1);
  return { value: n, label: `Versão ${n}` };
});

export function mergeCatalog(
  base: ComexEnumOption[],
  extra: Array<string | ComexEnumOption | null | undefined>,
): ComexEnumOption[] {
  const map = new Map<string, ComexEnumOption>();
  for (const item of [...base, ...extra]) {
    if (!item) continue;
    if (typeof item === 'string') {
      const value = item.trim();
      if (!value) continue;
      if (!map.has(value)) map.set(value, { value, label: value });
      continue;
    }
    if (!item.value) continue;
    map.set(item.value, item);
  }
  return [...map.values()];
}
