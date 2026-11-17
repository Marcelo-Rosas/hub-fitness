/**
 * Tabela NCM oficial do Portal Único (serviço de classificação).
 * O Portal NÃO tem consulta por código: só o download da tabela inteira,
 * público (sem certificado/autenticação):
 *   GET {base}/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO
 * ~3 MB / ~15 mil itens. Cache em memória por 24 h.
 */

export const NCM_TABLE_PATH = '/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface NcmItem {
  Codigo: string;
  Descricao: string;
  Data_Inicio?: string;
  Data_Fim?: string;
  Tipo_Ato_Ini?: string;
  Numero_Ato_Ini?: string;
  Ano_Ato_Ini?: string;
}

export interface NcmTable {
  atualizadoEm: string | null;
  itens: NcmItem[];
}

export interface NcmLookup {
  ncm: NcmItem;
  /** Do mais geral ao mais específico: capítulo, posição, subposições (só os que existem na tabela). */
  hierarquia: NcmItem[];
  tabelaAtualizadaEm: string | null;
}

const digits = (s: string) => String(s ?? '').replace(/\D/g, '');

let cache: { base: string; at: number; table: NcmTable } | null = null;

/** Só para testes. */
export function resetNcmTableCache(): void {
  cache = null;
}

export function parseNcmTable(raw: string): NcmTable {
  const j = JSON.parse(raw.replace(/^﻿/, '')) as {
    Data_Ultima_Atualizacao_NCM?: string;
    Nomenclaturas?: NcmItem[];
  };
  if (!Array.isArray(j.Nomenclaturas)) throw new Error('Tabela NCM sem "Nomenclaturas"');
  return { atualizadoEm: j.Data_Ultima_Atualizacao_NCM ?? null, itens: j.Nomenclaturas };
}

export async function getNcmTable(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<NcmTable> {
  if (cache && cache.base === baseUrl && now - cache.at < TTL_MS) return cache.table;
  const res = await fetchImpl(`${baseUrl}${NCM_TABLE_PATH}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Tabela NCM indisponível (HTTP ${res.status})`);
  const table = parseNcmTable(await res.text());
  cache = { base: baseUrl, at: now, table };
  return table;
}

/** Procura o código (com ou sem pontos) e monta a hierarquia 2/4/5/6/7 dígitos. */
export function lookupNcm(table: NcmTable, code: string): NcmLookup | null {
  const target = digits(code);
  if (target.length !== 8) return null;
  const byDigits = new Map<string, NcmItem>();
  for (const it of table.itens) byDigits.set(digits(it.Codigo), it);
  const ncm = byDigits.get(target);
  if (!ncm) return null;
  const hierarquia: NcmItem[] = [];
  for (const len of [2, 4, 5, 6, 7]) {
    const parent = byDigits.get(target.slice(0, len));
    if (parent) hierarquia.push(parent);
  }
  return { ncm, hierarquia, tabelaAtualizadaEm: table.atualizadoEm };
}
