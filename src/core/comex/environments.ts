/**
 * Ambientes e papéis oficiais PUCOMEX
 * Fonte: https://docs.portalunico.siscomex.gov.br/ambientes/
 *        https://docs.portalunico.siscomex.gov.br/introducao-api-publica/
 */

export type PucomexEnvironmentId = 'validacao' | 'producao' | 'homologacao';

export interface PucomexEnvironment {
  id: PucomexEnvironmentId;
  label: string;
  baseUrl: string;
  availability: string;
  docsNote: string;
}

export const PUCOMEX_ENVIRONMENTS: Record<PucomexEnvironmentId, PucomexEnvironment> = {
  validacao: {
    id: 'validacao',
    label: 'Treinamento / Validação',
    baseUrl: 'https://val.portalunico.siscomex.gov.br',
    availability: 'Público geral — desenvolvimento e testes',
    docsNote: 'Preferencial para integração HUB-FITNESS até go-live.',
  },
  producao: {
    id: 'producao',
    label: 'Produção',
    baseUrl: 'https://portalunico.siscomex.gov.br',
    availability: 'Público geral',
    docsNote: 'Requer certificado ICP-Brasil habilitado no Portal.',
  },
  homologacao: {
    id: 'homologacao',
    label: 'Homologação Serpro',
    baseUrl: 'https://hom.pucomex.serpro.gov.br',
    availability: 'Restrito — autorização prévia',
    docsNote: 'Uso interno Serpro / entidades autorizadas.',
  },
};

/** Role-Type header — intervenientes privados (docs oficiais) */
export const PUCOMEX_ROLE_TYPES = [
  { code: 'IMPEXP', label: 'Declarante importador/exportador', eCpf: true, eCnpj: false },
  { code: 'DEPOSIT', label: 'Depositário', eCpf: true, eCnpj: true },
  { code: 'OPERPORT', label: 'Operador Portuário', eCpf: true, eCnpj: true },
  { code: 'TRANSPORT', label: 'Transportador', eCpf: true, eCnpj: true },
  { code: 'TRANSPEST', label: 'PF – Representante de TETI', eCpf: true, eCnpj: false },
  { code: 'AGECARGA', label: 'Agente de Carga', eCpf: true, eCnpj: false },
  { code: 'AGEREMESS', label: 'Remessa Expressa/Correio', eCpf: true, eCnpj: true },
  { code: 'AJUDESPAC', label: 'Ajudante de Despachante', eCpf: true, eCnpj: false },
  { code: 'INSTFINANC', label: 'Instituição Financeira', eCpf: true, eCnpj: false },
  { code: 'CONTATOOEA', label: 'Ponto de Contato OEA', eCpf: true, eCnpj: false },
  { code: 'RESPLEGAL', label: 'Responsável Legal OE', eCpf: true, eCnpj: false },
  { code: 'HABILITAD', label: 'Habilitador', eCpf: true, eCnpj: false },
  { code: 'TERCEIROS', label: 'Terceiros (Outros Intervenientes)', eCpf: false, eCnpj: true },
] as const;

export type PucomexRoleType = (typeof PUCOMEX_ROLE_TYPES)[number]['code'];

/** Perfil default — VECTRA HUB autentica OPERPORT hoje; DEPOSIT exige habilitação RFB */
export const DEFAULT_PUCOMEX_ROLE: PucomexRoleType = 'OPERPORT';

/** Intervalo mínimo entre autenticar() — política Portal (60s) */
export const PUCOMEX_MIN_AUTH_INTERVAL_MS = 60_000;

/** TTL típico CSRF (docs: 60 min); renovado a cada request */
export const PUCOMEX_CSRF_TTL_MS = 60 * 60_000;

export const PUCOMEX_DOCS_HOME = 'https://docs.portalunico.siscomex.gov.br/';
export const PUCOMEX_DOCS_AUTH = 'https://docs.portalunico.siscomex.gov.br/introducao-api-publica/';
export const PUCOMEX_DOCS_ENV = 'https://docs.portalunico.siscomex.gov.br/ambientes/';
export const TABADU_VALIDACAO =
  'https://tabadu-pub.hom.receita.fazenda.gov.br/tabaduaneiras-web/public/pages/security/login_publico.jsf';
export const TABADU_PRODUCAO =
  'https://www35.receita.fazenda.gov.br/tabaduaneiras-web/public/pages/security/login_publico.jsf';
