export type UserRole = 'cfo' | 'socio' | 'comite' | 'comercial' | 'compras';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  avatar?: string;
}

export interface RoleConfig {
  id: UserRole;
  name: string;
  description: string;
  canEdit: boolean;
  canInspect: boolean;
  pitchModeOnly: boolean;
}

export type DreSection = 'receita' | 'custo' | 'despesa';
export type DreItemType = 'fixo' | 'variavel' | 'operacional' | 'servico';

export interface DreCompositionLine {
  id: string;
  name: string;
  formula?: string;
  monthlyAmountY1: number;
  monthlyAmountY2: number;
}

export interface DreGranularItem {
  id: string;
  section: DreSection;
  type: DreItemType;
  category: string;
  name: string;
  monthlyAmountY1: number; // R$/mês no Ano 1
  monthlyAmountY2: number; // R$/mês no Ano 2
  isPercentageOfRevenue?: boolean;
  percentageValue?: number;
  active: boolean;
  notes?: string;
  accountCode?: string; // e.g. "4.1.01.01" ou "5.2.02.01"
  costCenterId?: string; // e.g. "CC 001", "CC 002"
  composition?: DreCompositionLine[];
  /** CLIA e outras linhas cuja fórmula o engine sempre recalcula. */
  engineLocked?: boolean;
  /** Depois de edição humana, semente de ocupação/tech não sobrescreve. */
  manualOverride?: boolean;
}

export interface CellData {
  id: string;
  label: string;
  value: number;
  isInput: boolean;
  formula?: string;
  formulaTree?: string[];
  unit?: string;
  format?: 'currency' | 'percent' | 'number' | 'ratio';
}

export interface DreMonth {
  month: number; // 1 to 24
  label: string; // "M1", "M2", etc.
  receitaServicos: number;
  das6Percent: number; // Dedução DAS
  irpj: number;
  csll: number;
  pisCofinsCppIss: number;
  custosOperacionais: number; // Custos
  despesasOperacionais: number; // Despesas
  lucroLiquido: number;
}

export interface VasDriver {
  id: string;
  category: string;
  service: string;
  tier: string;
  price: number;
  unit: string;
  quantityM1_6: number;
  quantityM7_12: number;
  quantityM13_24: number;
  mixPercent: number;
  revenue: number;
}

export interface Scenario {
  id: string;
  name: string;
  isBaseline: boolean;
  occupancyRate: number; // e.g. 0.75 for 75%
  llM7Plus: number;
  capexTotal: number;
  m24Cash: number;
  fatorR: number; // e.g. 28.4
  mitigationStrategy?: string;
  status: 'ok' | 'warning' | 'critical';
  notes?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  driver: string;
  before: string;
  after: string;
  timestamp: string;
}

export interface SwotItem {
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact: string;
}

export interface GovernanceCheck {
  id: string;
  label: string;
  status: 'passed' | 'warning' | 'blocked';
  detail: string;
  isLockedRule: boolean;
}

export interface MappedVsImplementedCostItem {
  id: string;
  category: string;
  itemName: string;
  mappedJsonAmountY1: number; // R$/mês mapeado no modelo base
  implementedDreAmountY1: number; // R$/mês ativo no DRE Granular
  unitOfMeasure: string;
  status: 'completo' | 'parcial' | 'pendente_cotacao' | 'otimizado';
  gapDescription: string;
  recommendedAction: string;
}

export type SupplierState = 'SP' | 'PR' | 'SC';

export type MaterialCategory =
  | 'Filme Stretch'
  | 'Plástico Bolha'
  | 'Paletes PBR HT Madeira'
  | 'Paletes Plástico PEAD'
  /** @deprecated Prefer Madeira / PEAD */
  | 'Paletes PBR HT / Plástico'
  | 'Locação Empilhadeiras'
  | 'Fitas PET'
  | 'Cantoneiras'
  /** @deprecated Prefer Fitas PET / Cantoneiras — mantido p/ seeds legados */
  | 'Fitas & Cantoneiras'
  | 'Energia Trifásica / Baterias'
  | 'Etiquetas WMS'
  | 'Ribbons'
  | 'Fita Lacre'
  | 'EPIs'
  | 'Uniformes'
  | 'Outros AG';

export interface SupplierCompany {
  id: string;
  name: string;
  state: SupplierState;
  city: string;
  specialty: string;
  rating: number; // 1.0 to 5.0
  deliveryLeadTimeDays: number;
  freightType: 'CIF' | 'FOB';
  paymentTerms: string;
  icmsTaxRate: number; // e.g. 18% SP, 12% PR/SC
  contactPhone: string;
  contactEmail: string;
  cnpj?: string;
  website?: string;
}

export interface SupplierQuote {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierState: SupplierState;
  materialCategory: MaterialCategory;
  /** Conta analítica do Plano (1 conta = 1 insumo). Ex.: 5.1.01.03 */
  accountCode?: string;
  productDescription: string;
  unitPrice: number; // R$ por unidade
  monthlyVolumeUnit: number; // Quantidade mensal estimada
  /** Sempre ausente na UI — HUB sem histórico; não exibir narrativa inventada. */
  volumeBasis?: string;
  totalMonthlyCost: number; // R$ total por mês
  shippingCostMonthly: number; // Custo de frete estimado por mês
  totalMonthlyWithFreight: number;
  /** Prazo até Itajaí/SC (dias). Se ausente, UI tenta company ou mostra — */
  deliveryLeadTimeDays?: number;
  score: number; // 0 to 100 — heurística UI, não confiança de modelo
  /** Rótulo explícito da heurística (ex.: "heurística: vencedor matriz"). */
  scoreLabel?: string;
  isRecommendedWinner?: boolean;
  notes: string;
}

export interface CustomerMixProfileRecord {
  Perfil: string;
  MC_pos_R$: string;
  Ticket_R$: string;
  BE_Original_164k_pct: string;
  BE_Enxuto_120k_pct: string;
  BE_Realista_143k_pct: string;
  LL_100pct_Original: string;
  LL_100pct_Enxuto: string;
  LL_100pct_Realista: string;
  LL_88pct_Original: string;
  LL_88pct_Enxuto: string;
  LL_88pct_Realista: string;
  '4PL_CT_por_cliente_R$mes': string;
  Mix_recomendado: string;
  Cap_regra: string;
  Gatilho: string;
}

export interface ClientMixWeights {
  p1: number; // Estocador %
  p2: number; // Franquias %
  p4: number; // B2B Academias %
  p5: number; // Premium %
  presetName?: string;
}

