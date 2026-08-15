/** Tipos Comex / PUCOMEX — M18 HUB-FITNESS */

export type ComexOperationType = 'exportacao' | 'importacao';

export type ComexIncoterm = 'FOB' | 'CIF' | 'FCA' | 'DDP' | 'EXW';

export type ComexFieldEntity = 'process' | 'document';
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
  | 'customs';

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

export interface ComexProcessRecord {
  id: string;
  code: string;
  client_slug: string | null;
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
