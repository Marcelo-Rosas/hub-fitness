import type { ComexPort, ComexTableColumnMeta } from '../types/comex';

/** Subset Siscomex PORTO — foco SC hub + origem fitness CN + hubs BR */
export const COMEX_PORTS_DATA: ComexPort[] = [
  { codigo: 'BRNVT', descricao: 'NAVEGANTES', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'nvt-sc-01' },
  { codigo: 'BRIOA', descricao: 'ITAPOA', dataInicio: '01/01/2012', dataFim: '', internoVersao: 1, internoHash: 'ioa-sc-01' },
  { codigo: 'BRSSZ', descricao: 'SANTOS', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'ssz-sp-01' },
  { codigo: 'BRPNG', descricao: 'PARANAGUA', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'png-pr-01' },
  { codigo: 'BRITJ', descricao: 'ITAJAI', dataInicio: '01/01/2005', dataFim: '', internoVersao: 1, internoHash: 'itj-sc-01' },
  { codigo: 'BRRIG', descricao: 'RIO GRANDE', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'rig-rs-01' },
  { codigo: 'CNSHA', descricao: 'SHANGHAI', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'sha-cn-01' },
  { codigo: 'CNNGB', descricao: 'NINGBO', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'ngb-cn-01' },
  { codigo: 'CNSZX', descricao: 'SHENZHEN', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'szx-cn-01' },
  { codigo: 'CNQIN', descricao: 'QINGDAO', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'qin-cn-01' },
  { codigo: 'HKHKG', descricao: 'HONG KONG', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'hkg-hk-01' },
  { codigo: 'TWKEL', descricao: 'KEELUNG', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'kel-tw-01' },
  { codigo: 'USLAX', descricao: 'LOS ANGELES', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'lax-us-01' },
  { codigo: 'DEHAM', descricao: 'HAMBURG', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'ham-de-01' },
  { codigo: 'NLRTM', descricao: 'ROTTERDAM', dataInicio: '01/01/2000', dataFim: '', internoVersao: 1, internoHash: 'rtm-nl-01' },
];

export const PORTO_TABLE_METADATA: ComexTableColumnMeta[] = [
  { rotulo: 'Código', nome: 'codigo', descricao: 'Código do porto (chave de negócio)', tipo: 'Texto', tamanho: '5', formato: 'AAAAA', obrigatorio: 'Sim', chaveDeNegocio: 'Sim', restricaoUnicidade: 'Sim' },
  { rotulo: 'Descrição', nome: 'descricao', descricao: 'Nome do porto', tipo: 'Texto', tamanho: '60', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Data Inicial', nome: 'dataInicio', descricao: 'Início de vigência', tipo: 'Data', tamanho: '10', formato: 'DD/MM/AAAA', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Data Final', nome: 'dataFim', descricao: 'Fim de vigência (vazio = vigente)', tipo: 'Data', tamanho: '10', formato: 'DD/MM/AAAA', obrigatorio: 'Não', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Versão', nome: 'internoVersao', descricao: 'Versão interna do registro', tipo: 'Numérico', tamanho: '4', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Hash', nome: 'internoHash', descricao: 'Hash de integridade', tipo: 'Texto', tamanho: '40', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Sim' },
];
