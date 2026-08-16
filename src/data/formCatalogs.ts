export interface CatalogOption {
  value: string;
  label: string;
}

export interface ProductCatalogOption extends CatalogOption {
  /** Categoria do insumo — filtra Descrição do produto em todos os formulários. */
  category: string;
}

/** Catálogos de UI — dropdown com filtro. Não viram coluna de schema. */

/** Descrições de produto indexadas por categoria (fonte única p/ RFQ, cotação, ingestão). */
export const PRODUCT_DESCRIPTION_CATALOG: ProductCatalogOption[] = [
  { category: 'Filme Stretch', value: 'Filme Stretch 500mm', label: 'Filme Stretch 500mm' },
  {
    category: 'Filme Stretch',
    value: 'Filme Stretch automático 23µ',
    label: 'Filme Stretch automático 23µ',
  },
  {
    category: 'Filme Stretch',
    value: 'Filme Stretch Manual 500mm x 25 micras PEBD (Bobina 3.5kg)',
    label: 'Filme Stretch Manual 500mm x 25 micras PEBD (Bobina 3.5kg)',
  },
  {
    category: 'Filme Stretch',
    value: 'Filme Stretch 500mm x 25 micras Rolo 3.5kg (Caixa c/ 4 un)',
    label: 'Filme Stretch 500mm x 25 micras Rolo 3.5kg (Caixa c/ 4 un)',
  },
  {
    category: 'Filme Stretch',
    value: 'Filme Stretch Azul/Transparente 500mm (Bobina 3.0kg)',
    label: 'Filme Stretch Azul/Transparente 500mm (Bobina 3.0kg)',
  },
  { category: 'Paletes PBR HT / Plástico', value: 'Paletes PBR HT madeira', label: 'Paletes PBR HT madeira' },
  { category: 'Paletes PBR HT / Plástico', value: 'Paletes plástico PEAD', label: 'Paletes plástico PEAD' },
  {
    category: 'Paletes PBR HT / Plástico',
    value: 'Palete Madeira PBR Novo (1,20x1,00m) Tratado HT Fitossanitário 1.200kg',
    label: 'Palete Madeira PBR Novo (1,20x1,00m) Tratado HT Fitossanitário 1.200kg',
  },
  {
    category: 'Paletes PBR HT / Plástico',
    value: 'Palete PBR1 Recondicionado / Novo Certificado ABRAS',
    label: 'Palete PBR1 Recondicionado / Novo Certificado ABRAS',
  },
  {
    category: 'Paletes PBR HT / Plástico',
    value: 'Palete Plástico PEAD Reforçado Racks Heavy-Duty 1.500kg (Locação/Compra)',
    label: 'Palete Plástico PEAD Reforçado Racks Heavy-Duty 1.500kg (Locação/Compra)',
  },
  {
    category: 'Locação Empilhadeiras',
    value: 'Locação empilhadeira elétrica',
    label: 'Locação empilhadeira elétrica',
  },
  {
    category: 'Locação Empilhadeiras',
    value: 'Empilhadeira Elétrica STILL RX20-20 (2.5t) + Bateria Lítio + Carregador + SLA 4h',
    label: 'Empilhadeira Elétrica STILL RX20-20 (2.5t) + Bateria Lítio + Carregador + SLA 4h',
  },
  {
    category: 'Locação Empilhadeiras',
    value: 'Empilhadeira Elétrica Hyster J2.5XN (2.5t) Full Service com manutenção',
    label: 'Empilhadeira Elétrica Hyster J2.5XN (2.5t) Full Service com manutenção',
  },
  {
    category: 'Locação Empilhadeiras',
    value: 'Empilhadeira Elétrica Yale ERP25 + Transpaleteira Elétrica Tracionária',
    label: 'Empilhadeira Elétrica Yale ERP25 + Transpaleteira Elétrica Tracionária',
  },
  { category: 'Fitas PET', value: 'Fita de Arquear PET 16–19mm', label: 'Fita de Arquear PET 16–19mm' },
  { category: 'Fitas PET', value: 'Fitas PET e cantoneiras', label: 'Fitas PET (legado)' },
  { category: 'Cantoneiras', value: 'Cantoneira rígida 50x50x3mm', label: 'Cantoneira rígida 50x50x3mm' },
  { category: 'Fitas & Cantoneiras', value: 'Fitas PET e cantoneiras', label: 'Fitas PET e cantoneiras (legado)' },
  {
    category: 'Energia Trifásica / Baterias',
    value: 'Energia trifásica / baterias LFP',
    label: 'Energia trifásica / baterias LFP',
  },
  { category: 'Etiquetas WMS', value: 'Etiquetas EAN / WMS', label: 'Etiquetas EAN / WMS' },
  { category: 'EPIs', value: 'EPIs & uniformes operacionais', label: 'EPIs & uniformes operacionais' },
];

/** Lista plana (compat). Preferir `productsForCategory`. */
export const RFQ_INSUMO_CATALOG: CatalogOption[] = PRODUCT_DESCRIPTION_CATALOG.map(
  ({ value, label }) => ({ value, label }),
);

/** Opções de descrição filtradas pela categoria do insumo (+ extras livres / já cadastrados). */
export function productsForCategory(
  category: string,
  extras: Iterable<string> = [],
): CatalogOption[] {
  const seen = new Set<string>();
  const out: CatalogOption[] = [];
  for (const p of PRODUCT_DESCRIPTION_CATALOG) {
    if (p.category !== category || seen.has(p.value)) continue;
    seen.add(p.value);
    out.push({ value: p.value, label: p.label });
  }
  for (const e of extras) {
    const v = e?.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push({ value: v, label: v });
  }
  return out;
}

export function categoryForProduct(product: string): string | undefined {
  return PRODUCT_DESCRIPTION_CATALOG.find((p) => p.value === product)?.category;
}

export const RFQ_VOLUME_CATALOG: CatalogOption[] = [
  { value: '50', label: '50 un / mês' },
  { value: '100', label: '100 un / mês' },
  { value: '150', label: '150 un / mês' },
  { value: '200', label: '200 un / mês' },
  { value: '300', label: '300 un / mês' },
  { value: '500', label: '500 un / mês' },
];

export const RFQ_PAYMENT_CATALOG: CatalogOption[] = [
  { value: '30 dias no boleto', label: '30 dias no boleto' },
  { value: '30/60 dias no boleto', label: '30/60 dias no boleto' },
  { value: '30 / 60 / 90 dias', label: '30 / 60 / 90 dias' },
  { value: 'Mensal 30 dias', label: 'Mensal 30 dias' },
  { value: 'À vista (PIX 5% desconto)', label: 'À vista (PIX 5% desconto)' },
];

/** Destino RFQ = hubParams.site (metadado do projeto). Não inventar hub SP/PR aqui. */

export const INTRANET_SECTOR_CATALOG: CatalogOption[] = [
  { value: 'compras', label: 'Compras & Suprimentos' },
  { value: 'financeiro', label: 'Financeiro (CFO)' },
  { value: 'diretoria', label: 'Diretoria / Board' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'logistica', label: 'Logística & SLA' },
  { value: 'comex', label: 'Comex / PUCOMEX' },
];

export const DECISION_ROLE_CATALOG: CatalogOption[] = [
  { value: 'cfo', label: 'CFO / Controller — Financeiro' },
  { value: 'socio', label: 'Sócio / Board — Diretoria' },
];

/** Leads comerciais CRM/CPQ — Konnen dogfood fica fora (só calibração / Comex). */
export const CRM_LEAD_CATALOG: CatalogOption[] = [
  { value: 'MaxFitness Importadora Ltda', label: 'MaxFitness Importadora Ltda' },
  { value: 'MaxFitness Equipamentos', label: 'MaxFitness Equipamentos' },
  { value: 'SportWear Brasil E-commerce', label: 'SportWear Brasil E-commerce' },
  { value: 'Rede Academias PowerFit', label: 'Rede Academias PowerFit' },
  { value: 'Importadora Suplementos SC', label: 'Importadora Suplementos SC' },
  { value: 'Impulse Fitness', label: 'Impulse Fitness' },
];

export function isDogfoodLead(value: string): boolean {
  return /konnen|dogfood/i.test(value);
}

export const MATERIAL_CATEGORY_CATALOG: CatalogOption[] = [
  { value: 'Filme Stretch', label: 'Filme Stretch' },
  { value: 'Plástico Bolha', label: 'Plástico Bolha' },
  { value: 'Fitas PET', label: 'Fitas PET' },
  { value: 'Cantoneiras', label: 'Cantoneiras' },
  { value: 'Etiquetas WMS', label: 'Etiquetas WMS' },
  { value: 'Ribbons', label: 'Ribbons' },
  { value: 'Fita Lacre', label: 'Fita Lacre' },
  { value: 'EPIs', label: 'EPIs' },
  { value: 'Uniformes', label: 'Uniformes' },
  { value: 'Paletes PBR HT Madeira', label: 'Paletes PBR HT Madeira' },
  { value: 'Paletes Plástico PEAD', label: 'Paletes Plástico PEAD' },
  { value: 'Paletes PBR HT / Plástico', label: 'Paletes (legado)' },
  { value: 'Locação Empilhadeiras', label: 'Locação Empilhadeiras' },
  { value: 'Fitas & Cantoneiras', label: 'Fitas & Cantoneiras (legado)' },
  { value: 'Energia Trifásica / Baterias', label: 'Energia Trifásica / Baterias' },
  { value: 'Outros AG', label: 'Outros insumos AG' },
];

export const STATE_FILTER_CATALOG: CatalogOption[] = [
  { value: 'TODOS', label: 'SP, PR e SC (Todos)' },
  { value: 'SP', label: 'São Paulo (SP)' },
  { value: 'PR', label: 'Paraná (PR)' },
  { value: 'SC', label: 'Santa Catarina (SC)' },
];

export function labelForSector(id: string): string {
  return INTRANET_SECTOR_CATALOG.find((s) => s.value === id)?.label || id;
}
