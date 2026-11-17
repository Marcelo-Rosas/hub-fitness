/** Tipos Comex / PUCOMEX — M18 HUB-FITNESS */

export type ComexOperationType = 'exportacao' | 'importacao';

export type ComexIncoterm = 'FOB' | 'CIF' | 'FCA' | 'DDP' | 'EXW';

export type ComexFieldEntity = 'process' | 'document' | 'client' | 'broker';
export type ComexFieldDataType = 'text' | 'number' | 'date' | 'enum' | 'boolean' | 'json';
export type ComexFieldWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'port'
  | 'date'
  | 'client'
  | 'ncm'
  | 'customs'
  /** Opções = despachantes ativos (dinâmico). */
  | 'broker';

export interface ComexEnumOption {
  value: string;
  label: string;
}

export interface ComexFieldDefInput {
  entity: ComexFieldEntity;
  field_key: string;
  label: string;
  data_type: ComexFieldDataType;
  required?: boolean;
  enum_options?: ComexEnumOption[];
  widget?: ComexFieldWidget;
  ui_list?: boolean;
  ui_form?: boolean;
  consult_key?: boolean;
  kpi?: string | null;
  sort_order?: number;
  /** Seção do formulário de cadastro (ex.: 'Empresa', 'Radar'). */
  ui_group?: string | null;
}

export interface ComexFieldDef extends ComexFieldDefInput {
  id: string;
  required: boolean;
  enum_options: ComexEnumOption[];
  widget: ComexFieldWidget;
  ui_list: boolean;
  ui_form: boolean;
  consult_key: boolean;
  kpi: string | null;
  sort_order: number;
  ui_group: string | null;
}

export interface ComexDocumentRecord {
  id: string;
  process_id: string | null;
  doc_type: string;
  file_name: string;
  file_path: string;
  size_bytes: number | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export type ComexRadarModality = 'expressa' | 'limitada_50k' | 'limitada_150k' | 'ilimitada';
export type ComexRepStatus = 'pendente' | 'ativa' | 'vencida' | 'revogada';

export interface ComexClientRecord {
  id: string;
  cnpj_root: string;
  cnpj: string | null;
  legal_name: string;
  trade_name: string | null;
  slug: string;
  radar_status: string | null;
  radar_modality: ComexRadarModality | null;
  radar_limit_usd: number | null;
  radar_operations: string | null;
  radar_legal_basis: string | null;
  radar_checked_at: string | null;
  rep_status: ComexRepStatus;
  rep_certificate: string | null;
  rep_role_type: string | null;
  rep_valid_from: string | null;
  rep_valid_to: string | null;
  broker_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ComexClientInput = Omit<ComexClientRecord, 'id' | 'slug' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export interface ComexBrokerRecord {
  id: string;
  name: string;
  cpf: string | null;
  rfb_registry: string | null;
  email: string | null;
  phone: string | null;
  certificate_status: 'pendente';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComexBrokerInput {
  id?: string;
  name: string;
  cpf?: string | null;
  rfb_registry?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

export interface ComexProcessRecord {
  id: string;
  code: string;
  client_slug: string | null;
  cliente_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  documents?: ComexDocumentRecord[];
}

/** @deprecated use ComexProcessRecord.payload — mantido só para seed DEMO de auth */
export interface ComexProcess {
  id: string;
  code: string;
  clientName: string;
  type: ComexOperationType;
  declarationNumber: string;
  ncmCode: string;
  productDescription: string;
  fobValueUsd: number;
  cifValueBrl: number;
  countryDestinationOrOrigin: string;
  portOfOriginCode?: string;
  portOfOriginName?: string;
  portOfDestinationCode?: string;
  portOfDestinationName?: string;
  incoterm: ComexIncoterm;
  customsHouse: string;
  status: string;
  pucomexStatus: string;
  lastPucomexSync: string;
  notes?: string;
}

export interface PucomexAuthSession {
  cnpjeCPF: string;
  role: string;
  environment: string;
  tokenPreview: string;
  expiresAt?: string;
  csrfExpiresAt?: string;
  mode?: 'live' | 'demo';
  roleType?: string;
  authenticatedAt?: string;
}

export interface PucomexPortalStatus {
  certConfigured: boolean;
  liveModeEnabled: boolean;
  environment: string;
  baseUrl: string;
  roleType: string;
  sessionActive: boolean;
  sessionMode: 'live' | 'demo' | null;
  csrfExpiresAt: string | null;
  docsHome: string;
  certThumbprint?: string | null;
  certSource?: 'pfx' | 'windows-store' | null;
  /** Erro ao abrir o PFX (ex.: mac verify failure) — null quando ok */
  certError?: string | null;
}

export interface ComexGuardStatus {
  operatorTokenRequired: boolean;
  operatorTokenConfigured: boolean;
}

export interface ComexPort {
  codigo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  internoVersao: number;
  internoHash: string;
}

export interface ComexAtitCity {
  codigo: string;
  descricao: string;
  codigoSubdivisao: string;
  siglaIso2Pais: string;
  dataInicio: string;
  dataFim: string;
  internoVersao: number;
  internoHash: string;
}

export interface ComexTableColumnMeta {
  rotulo: string;
  nome: string;
  descricao: string;
  tipo: string;
  tamanho: string;
  formato: string;
  obrigatorio: 'Sim' | 'Não';
  chaveDeNegocio: 'Sim' | 'Não';
  restricaoUnicidade: 'Sim' | 'Não';
}
