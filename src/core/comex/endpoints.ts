/**
 * Catálogo de módulos / endpoints alinhado à documentação pública PUCOMEX
 * https://docs.portalunico.siscomex.gov.br/
 *
 * Paths oficiais usados no cliente; demais módulos listados para navegação M18.
 */

export interface PucomexEndpointDef {
  id: string;
  module: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pathTemplate: string;
  description: string;
  docsUrl: string;
  implemented: boolean;
}

export const PUCOMEX_ENDPOINT_CATALOG: PucomexEndpointDef[] = [
  {
    id: 'auth',
    module: 'Plataforma',
    method: 'POST',
    pathTemplate: '/portal/api/autenticar',
    description: 'Autenticação mTLS (e-CPF/e-CNPJ). Header Role-Type. Retorna Set-Token + X-CSRF-Token.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/introducao-api-publica/',
    implemented: true,
  },
  {
    id: 'auth-sistema',
    module: 'Plataforma',
    method: 'POST',
    pathTemplate: '/portal/api/autenticar/sistema',
    description: 'Autenticação com certificado de equipamento (intervenientes públicos).',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/introducao-api-publica/',
    implemented: false,
  },
  {
    id: 'due-consultar',
    module: 'DU-E',
    method: 'GET',
    pathTemplate: '/due/api/ext/due/numero-da-due/{numero}',
    description: 'Obter DU-E completa por número.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: true,
  },
  {
    id: 'due-registrar',
    module: 'DU-E',
    method: 'POST',
    pathTemplate: '/due/api/ext/due',
    description: 'Elaboração / registro de DU-E (XML/JSON conforme XSD).',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: true,
  },
  {
    id: 'due-retificar',
    module: 'DU-E',
    method: 'PUT',
    pathTemplate: '/due/api/ext/due/{id}',
    description: 'Retificação de DU-E.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: false,
  },
  {
    id: 'duimp-consultar',
    module: 'DUIMP',
    method: 'GET',
    pathTemplate: '/duimp/api/ext/duimp/{numero}/{versao}',
    description: 'Consulta declaração única de importação (ext).',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/api/dimp/',
    implemented: true,
  },
  {
    id: 'cct-exp-consulta-due',
    module: 'CCT Exportação',
    method: 'GET',
    pathTemplate: '/cct/api/ext/carga/consulta-por-due/{numero}',
    description: 'Consulta carga CCT por DU-E / RUC.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: true,
  },
  {
    id: 'cct-imp-aquaviario',
    module: 'CCT Importação Aquaviário',
    method: 'GET',
    pathTemplate: '/ccta/api/ext/conhecimentos/{identificador}',
    description: 'Consulta conhecimento / manifesto aquaviário (Navegantes/Itapoá).',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: true,
  },
  {
    id: 'catalogo-produtos',
    module: 'Catálogo de Produtos',
    method: 'GET',
    pathTemplate: '/catalogo-produtos-ext/api/ext/produto',
    description: 'Consulta produtos do catálogo NCM/atributos do interveniente.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: true,
  },
  {
    id: 'lpco',
    module: 'Tratamento Administrativo / LPCO',
    method: 'GET',
    pathTemplate: '/talpco/api/ext/lpco',
    description: 'Consulta LPCOs vinculados à operação.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: false,
  },
  {
    id: 'classif-fiscal',
    module: 'Classificação Fiscal',
    method: 'GET',
    pathTemplate: '/classif/api/publico/nomenclatura/ncm/{codigo}',
    description: 'Consulta pública NCM (quando disponível no ambiente).',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: true,
  },
  {
    id: 'tabelas-comex',
    module: 'Tabelas Comex',
    method: 'GET',
    pathTemplate: '/cadatributos/api/ext/atributo',
    description: 'Cadastro de atributos / apoio a tabelas Comex.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/pages/tabelas_dominio/',
    implemented: false,
  },
  {
    id: 'pagamento-centralizado',
    module: 'Pagamento Centralizado',
    method: 'GET',
    pathTemplate: '/pagamentocentralizado/api/ext/',
    description: 'Módulo de pagamento centralizado de tributos.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: false,
  },
  {
    id: 'recintos',
    module: 'Recintos Aduaneiros',
    method: 'GET',
    pathTemplate: '/recintos-ext/api/ext/',
    description: 'Serviços de recintos (perfil depositário).',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: false,
  },
  {
    id: 'anexacao',
    module: 'Anexação Eletrônica',
    method: 'GET',
    pathTemplate: '/due/api/ext/anexacao/',
    description: 'Consulta tipos / documentos anexados à operação.',
    docsUrl: 'https://docs.portalunico.siscomex.gov.br/',
    implemented: false,
  },
];

export const PUCOMEX_MODULE_LINKS = [
  { title: 'Aspectos Gerais / Auth', url: 'https://docs.portalunico.siscomex.gov.br/introducao-api-publica/' },
  { title: 'Ambientes', url: 'https://docs.portalunico.siscomex.gov.br/ambientes/' },
  { title: 'DU-E', url: 'https://docs.portalunico.siscomex.gov.br/' },
  { title: 'DUIMP', url: 'https://docs.portalunico.siscomex.gov.br/api/dimp/' },
  { title: 'CCT Exportação / Importação', url: 'https://docs.portalunico.siscomex.gov.br/' },
  { title: 'Catálogo de Produtos', url: 'https://docs.portalunico.siscomex.gov.br/' },
  { title: 'LPCO / Tratamento Administrativo', url: 'https://docs.portalunico.siscomex.gov.br/' },
  { title: 'Tabelas de domínio (Tabadu)', url: 'https://docs.portalunico.siscomex.gov.br/pages/tabelas_dominio/' },
  { title: 'Notificações push', url: 'https://docs.portalunico.siscomex.gov.br/' },
  { title: 'Home docs', url: 'https://docs.portalunico.siscomex.gov.br/' },
];

export function fillPathTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(params[key] ?? ''));
}
