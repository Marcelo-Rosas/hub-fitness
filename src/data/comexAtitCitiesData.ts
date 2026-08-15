import type { ComexAtitCity, ComexTableColumnMeta } from '../types/comex';

/** Subset Cidade ATIT (CCT / trânsito terrestre Mercosul) */
export const COMEX_ATIT_CITIES_DATA: ComexAtitCity[] = [
  { codigo: 'ARROS', descricao: 'ROSARIO', codigoSubdivisao: 'S', siglaIso2Pais: 'AR', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-arros' },
  { codigo: 'ARBAI', descricao: 'BUENOS AIRES', codigoSubdivisao: 'C', siglaIso2Pais: 'AR', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-arbai' },
  { codigo: 'BRURA', descricao: 'URUGUAIANA', codigoSubdivisao: 'RS', siglaIso2Pais: 'BR', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-brura' },
  { codigo: 'BRFOZ', descricao: 'FOZ DO IGUACU', codigoSubdivisao: 'PR', siglaIso2Pais: 'BR', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-brfoz' },
  { codigo: 'BRNVG', descricao: 'NAVEGANTES', codigoSubdivisao: 'SC', siglaIso2Pais: 'BR', dataInicio: '01/01/2015', dataFim: '', internoVersao: 1, internoHash: 'atit-brnvg' },
  { codigo: 'UYMON', descricao: 'MONTEVIDEO', codigoSubdivisao: 'MO', siglaIso2Pais: 'UY', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-uymon' },
  { codigo: 'PYASU', descricao: 'ASUNCION', codigoSubdivisao: 'AS', siglaIso2Pais: 'PY', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-pyasu' },
  { codigo: 'CLSTI', descricao: 'SANTIAGO', codigoSubdivisao: 'RM', siglaIso2Pais: 'CL', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-clsti' },
  { codigo: 'BOCBB', descricao: 'COCHABAMBA', codigoSubdivisao: 'C', siglaIso2Pais: 'BO', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-bocbb' },
  { codigo: 'PELIM', descricao: 'LIMA', codigoSubdivisao: 'LIM', siglaIso2Pais: 'PE', dataInicio: '01/01/2010', dataFim: '', internoVersao: 1, internoHash: 'atit-pelim' },
];

export const ATIT_CITY_TABLE_METADATA: ComexTableColumnMeta[] = [
  { rotulo: 'Código', nome: 'codigo', descricao: 'Código ATIT da cidade', tipo: 'Texto', tamanho: '5', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Sim', restricaoUnicidade: 'Sim' },
  { rotulo: 'Descrição', nome: 'descricao', descricao: 'Nome da cidade', tipo: 'Texto', tamanho: '60', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Subdivisão', nome: 'codigoSubdivisao', descricao: 'Estado / província', tipo: 'Texto', tamanho: '3', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'País ISO2', nome: 'siglaIso2Pais', descricao: 'Sigla ISO 3166-1 alpha-2', tipo: 'Texto', tamanho: '2', formato: 'AA', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Data Inicial', nome: 'dataInicio', descricao: 'Início de vigência', tipo: 'Data', tamanho: '10', formato: 'DD/MM/AAAA', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Data Final', nome: 'dataFim', descricao: 'Fim de vigência', tipo: 'Data', tamanho: '10', formato: 'DD/MM/AAAA', obrigatorio: 'Não', chaveDeNegocio: 'Não', restricaoUnicidade: 'Não' },
  { rotulo: 'Hash', nome: 'internoHash', descricao: 'Hash interno', tipo: 'Texto', tamanho: '40', formato: '', obrigatorio: 'Sim', chaveDeNegocio: 'Não', restricaoUnicidade: 'Sim' },
];
