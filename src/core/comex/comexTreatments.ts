/**
 * Tratamentos da importação por NCM — módulo PURO (o front também importa).
 * - Administrativo (LPCO/anuentes): resposta de POST /talpco/api/ext/simular-ta/importacao
 * - Tributário (TTCE em lote): arquivo do capítulo em /ttce/api/ext/importacao/ncm-capitulos/{cap}/tratamentos-tributarios
 *   (traz tributos, regimes e fundamentos legais — NÃO traz alíquotas)
 */
import type { ComexRadarModality } from '../../types/comex';

/** Calcula II/IPI/PIS/COFINS; tem captcha — só abrimos em nova aba, sem automatizar. */
export const SIMULADOR_RECEITA_URL = 'https://www4.receita.fazenda.gov.br/simulador/';

/** ISO2 → código numérico de país usado na TTCE (tabela Siscomex). Só os confirmados. */
export const ISO2_TO_SISCOMEX: Record<string, string> = { CN: '160' };

export interface TaModelo {
  codigo: string;
  nome: string;
  preenchimento: string | null;
}

export interface TaItem {
  numeroTa: string;
  orgao: string;
  tipo: string;
  modelos: TaModelo[];
  mensagem: string | null;
  impedeDesembaraco: boolean;
  passivelInspecao: boolean;
  condicoes: string[];
}

export interface TaSummary {
  itens: TaItem[];
  orgaos: string[];
  exigeLpco: boolean;
  impedeDesembaraco: boolean;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));

export function summarizeTa(raw: unknown): TaSummary {
  const list = Array.isArray(raw) ? (raw as Raw[]) : [];
  const itens: TaItem[] = list.map((r) => {
    const modelos = Array.isArray(r.modelos)
      ? (r.modelos as Raw[]).map((m) => ({
          codigo: str(m.codigo),
          nome: str(m.nome),
          preenchimento: m.preenchimento == null ? null : str(m.preenchimento),
        }))
      : [];
    const condicoes: string[] = [];
    for (const ef of Array.isArray(r.efeitos) ? (r.efeitos as Raw[]) : []) {
      for (const c of Array.isArray(ef.condicoes) ? (ef.condicoes as Raw[]) : []) {
        const valores = Array.isArray(c.valores) ? (c.valores as Raw[]).map((v) => str(v.descricao)).filter(Boolean) : [];
        condicoes.push(valores.length ? `${str(c.descricaoCondicao)}: ${valores.join(', ')}` : str(c.descricaoCondicao));
      }
    }
    return {
      numeroTa: str(r.numeroTa),
      orgao: str(r.orgao),
      tipo: str(r.tipoTratamento),
      modelos,
      mensagem: r.mensagem == null ? null : str(r.mensagem),
      impedeDesembaraco: r.impedeDesembaraco === true,
      passivelInspecao: r.passivelInspecao === true,
      condicoes,
    };
  });
  return {
    itens,
    orgaos: [...new Set(itens.map((i) => i.orgao).filter(Boolean))].sort(),
    exigeLpco: itens.some((i) => i.modelos.length > 0 || /lpco/i.test(i.tipo)),
    impedeDesembaraco: itens.some((i) => i.impedeDesembaraco),
  };
}

export function buildRequiredDocuments(input: {
  radarModality: ComexRadarModality | null | undefined;
  ta: TaSummary | null;
}): string[] {
  const docs = ['Invoice comercial', 'Packing list', 'BL / conhecimento de embarque'];
  const m = input.radarModality;
  if (m === 'limitada_50k' || m === 'limitada_150k') docs.push('DI (Radar Limitado — DUIMP indisponível)');
  else if (m) docs.push('DUIMP');
  else docs.push('DI ou DUIMP (conforme o Radar do importador)');
  const lpcos = new Map<string, string[]>();
  for (const it of input.ta?.itens ?? []) {
    if (!it.modelos.length) continue;
    const arr = lpcos.get(it.orgao) ?? [];
    for (const mo of it.modelos) if (!arr.includes(mo.codigo)) arr.push(mo.codigo);
    lpcos.set(it.orgao, arr);
  }
  for (const [orgao, codigos] of lpcos) {
    docs.push(`LPCO ${orgao} — um dos modelos ${codigos.join(' / ')} conforme o caso`);
  }
  return docs;
}

export interface TtceTratamento {
  tributo: string;
  regime: string;
  fundamento: string;
  codigoFundamento: string;
  tipo: string;
  exigeAtributos: boolean;
  exTarifario: boolean;
}

export interface TtceNcmResult {
  tributos: string[];
  normais: TtceTratamento[];
  opcionais: TtceTratamento[];
}

/** Recorta do arquivo do capítulo o que vale para a NCM e a origem (código numérico Siscomex). */
export function ttceForNcm(file: unknown, ncm: string, paisCodigo: string | null): TtceNcmResult {
  const target = ncm.replace(/\D/g, '');
  const out: TtceNcmResult = { tributos: [], normais: [], opcionais: [] };
  const seen = new Set<string>();
  const intervalos = Array.isArray((file as Raw)?.intervalosNcm) ? ((file as Raw).intervalosNcm as Raw[]) : [];
  for (const iv of intervalos) {
    const ini = str(iv.intervaloInicialNcm).replace(/\D/g, '');
    const fim = str(iv.intervaloFinalNcm).replace(/\D/g, '');
    if (!(target >= ini && target <= fim)) continue;
    for (const od of Array.isArray(iv.origensDestinosTratamentos) ? (iv.origensDestinosTratamentos as Raw[]) : []) {
      const paises = Array.isArray(od.paisesOrigem) ? (od.paisesOrigem as unknown[]).map((p) => str(p).replace(/^0+/, '')) : [];
      const vale = od.todosPaisesOrigem === true || (paisCodigo != null && paises.includes(paisCodigo.replace(/^0+/, '')));
      if (!vale) continue;
      for (const dt of Array.isArray(od.destinosTratamentos) ? (od.destinosTratamentos as Raw[]) : []) {
        for (const t of Array.isArray(dt.tratamentosTributarios) ? (dt.tratamentosTributarios as Raw[]) : []) {
          const tributo = str((t.tributo as Raw)?.nome);
          const fl = (t.fundamentoLegal as Raw) ?? {};
          const item: TtceTratamento = {
            tributo,
            regime: str((t.regime as Raw)?.nome),
            fundamento: str(fl.nome),
            codigoFundamento: str(fl.codigo),
            tipo: str(fl.tipo),
            exigeAtributos: Array.isArray(t.mercadorias) && (t.mercadorias as unknown[]).length > 0,
            exTarifario: /ex[-\s]?tarif/i.test(str(fl.nome)),
          };
          const key = `${tributo}|${item.regime}|${item.codigoFundamento}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (tributo && !out.tributos.includes(tributo)) out.tributos.push(tributo);
          (/opcional/i.test(item.tipo) ? out.opcionais : out.normais).push(item);
        }
      }
    }
  }
  out.opcionais.sort((a, b) => Number(b.exTarifario) - Number(a.exTarifario));
  return out;
}

export function parseCountryIso2(label: string): string | null {
  const m = /\(([A-Za-z]{2})\)\s*$/.exec(label.trim());
  if (m) return m[1].toUpperCase();
  return /^[A-Za-z]{2}$/.test(label.trim()) ? label.trim().toUpperCase() : null;
}
