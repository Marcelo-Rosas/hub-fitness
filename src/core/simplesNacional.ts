/**
 * Simples Nacional — LC 123/2006 com redação da LC 155/2016 (vigente desde 2018).
 *
 * Substitui o antigo `dasPct` fixo (6% = só a 1ª faixa do Anexo III, RBT12 ≤ R$ 180 mil).
 * Alíquota efetiva = (RBT12 × nominal − parcela a deduzir) ÷ RBT12, por faixa.
 *
 * Fator R (art. 18 §5º-J/M): folha 12m ÷ RBT12 ≥ 28% → Anexo III; abaixo → Anexo V.
 * Início de atividade (art. 18 §2º): no 1º mês RBT12 = receita do mês × 12; nos 11
 * meses seguintes RBT12 = média dos meses anteriores × 12. O mesmo critério vale para
 * a folha do Fator R.
 *
 * Tributos: valores de referência. A Reforma Tributária (LC 214/2025) troca PIS/Cofins/ISS
 * por CBS/IBS dentro do DAS a partir de 2027; isso é tratado no módulo de reforma, não aqui.
 */

export type SimplesAnexo = 'III' | 'V';

export interface SimplesFaixa {
  /** Limite superior de RBT12 da faixa (inclusive). */
  ate: number;
  nominal: number;
  deduzir: number;
  /** Repartição do DAS (frações, somam 1). ISS = 0 na 6ª faixa: recolhido fora do DAS. */
  reparticao: { irpj: number; csll: number; cofins: number; pis: number; cpp: number; iss: number };
}

export const TETO_SIMPLES = 4_800_000;
export const SUBLIMITE_ICMS_ISS = 3_600_000;
export const FATOR_R_MIN = 0.28;
/** ISS dentro do DAS limitado a 5% efetivo (LC 123 Anexo III, nota da 5ª faixa). */
export const ISS_TETO_EFETIVO = 0.05;

export const ANEXO_III: SimplesFaixa[] = [
  { ate: 180_000, nominal: 0.06, deduzir: 0, reparticao: { irpj: 0.04, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.434, iss: 0.335 } },
  { ate: 360_000, nominal: 0.112, deduzir: 9_360, reparticao: { irpj: 0.04, csll: 0.035, cofins: 0.1405, pis: 0.0305, cpp: 0.434, iss: 0.32 } },
  { ate: 720_000, nominal: 0.135, deduzir: 17_640, reparticao: { irpj: 0.04, csll: 0.035, cofins: 0.1364, pis: 0.0296, cpp: 0.434, iss: 0.325 } },
  { ate: 1_800_000, nominal: 0.16, deduzir: 35_640, reparticao: { irpj: 0.04, csll: 0.035, cofins: 0.1364, pis: 0.0296, cpp: 0.434, iss: 0.325 } },
  { ate: 3_600_000, nominal: 0.21, deduzir: 125_640, reparticao: { irpj: 0.04, csll: 0.035, cofins: 0.1282, pis: 0.0278, cpp: 0.434, iss: 0.335 } },
  { ate: 4_800_000, nominal: 0.33, deduzir: 648_000, reparticao: { irpj: 0.35, csll: 0.15, cofins: 0.1603, pis: 0.0347, cpp: 0.305, iss: 0 } },
];

export const ANEXO_V: SimplesFaixa[] = [
  { ate: 180_000, nominal: 0.155, deduzir: 0, reparticao: { irpj: 0.25, csll: 0.15, cofins: 0.141, pis: 0.0305, cpp: 0.2885, iss: 0.14 } },
  { ate: 360_000, nominal: 0.18, deduzir: 4_500, reparticao: { irpj: 0.23, csll: 0.15, cofins: 0.141, pis: 0.0305, cpp: 0.2785, iss: 0.17 } },
  { ate: 720_000, nominal: 0.195, deduzir: 9_900, reparticao: { irpj: 0.24, csll: 0.15, cofins: 0.1492, pis: 0.0323, cpp: 0.2385, iss: 0.19 } },
  { ate: 1_800_000, nominal: 0.205, deduzir: 17_100, reparticao: { irpj: 0.21, csll: 0.15, cofins: 0.1574, pis: 0.0341, cpp: 0.2385, iss: 0.21 } },
  { ate: 3_600_000, nominal: 0.23, deduzir: 62_100, reparticao: { irpj: 0.23, csll: 0.125, cofins: 0.141, pis: 0.0305, cpp: 0.2385, iss: 0.235 } },
  { ate: 4_800_000, nominal: 0.305, deduzir: 540_000, reparticao: { irpj: 0.35, csll: 0.155, cofins: 0.1644, pis: 0.0356, cpp: 0.295, iss: 0 } },
];

export function tabelaAnexo(anexo: SimplesAnexo): SimplesFaixa[] {
  return anexo === 'III' ? ANEXO_III : ANEXO_V;
}

/** Índice 0-based da faixa. Acima do teto devolve a 6ª (com alerta via `acimaDoTeto`). */
export function faixaIndex(rbt12: number, anexo: SimplesAnexo): number {
  const tabela = tabelaAnexo(anexo);
  const idx = tabela.findIndex((f) => rbt12 <= f.ate);
  return idx === -1 ? tabela.length - 1 : idx;
}

export function aliquotaEfetiva(rbt12: number, anexo: SimplesAnexo): number {
  if (rbt12 <= 0) return tabelaAnexo(anexo)[0].nominal;
  const f = tabelaAnexo(anexo)[faixaIndex(rbt12, anexo)];
  return (rbt12 * f.nominal - f.deduzir) / rbt12;
}

/**
 * RBT12 do mês `idx` (0-based) a partir da série de receitas do próprio plano,
 * com proporcionalização de início de atividade (LC 123 art. 18 §2º).
 */
export function rbt12Inicio(receitas: number[], idx: number): number {
  if (idx === 0) return receitas[0] * 12;
  const anteriores = receitas.slice(Math.max(0, idx - 12), idx);
  const soma = anteriores.reduce((a, b) => a + b, 0);
  return anteriores.length < 12 ? (soma / anteriores.length) * 12 : soma;
}

export interface DasMes {
  rbt12: number;
  anexo: SimplesAnexo;
  faixa: number; // 1..6
  aliquotaEfetiva: number;
  das: number;
  irpj: number;
  csll: number;
  /** PIS + Cofins + CPP + ISS dentro do DAS. */
  pisCofinsCppIss: number;
  /** Fator R usado para escolher o anexo (fração, ex.: 0.284). */
  fatorR: number;
  acimaSublimite: boolean;
  acimaDoTeto: boolean;
}

/**
 * DAS de um mês. ISS acima de 5% efetivo é transferido proporcionalmente aos demais
 * tributos (total do DAS não muda; só a repartição).
 */
export function computeDasMes(receitaMes: number, rbt12: number, fatorR: number): DasMes {
  const anexo: SimplesAnexo = fatorR >= FATOR_R_MIN ? 'III' : 'V';
  const idx = faixaIndex(rbt12, anexo);
  const aliq = aliquotaEfetiva(rbt12, anexo);
  const das = receitaMes * aliq;
  const r = { ...tabelaAnexo(anexo)[idx].reparticao };

  const issEfetivo = aliq * r.iss;
  if (issEfetivo > ISS_TETO_EFETIVO) {
    const issNovo = ISS_TETO_EFETIVO / aliq;
    const excedente = r.iss - issNovo;
    const outros = 1 - r.iss;
    for (const k of ['irpj', 'csll', 'cofins', 'pis', 'cpp'] as const) {
      r[k] += excedente * (r[k] / outros);
    }
    r.iss = issNovo;
  }

  const irpj = das * r.irpj;
  const csll = das * r.csll;
  return {
    rbt12,
    anexo,
    faixa: idx + 1,
    aliquotaEfetiva: aliq,
    das,
    irpj,
    csll,
    pisCofinsCppIss: das - irpj - csll,
    fatorR,
    acimaSublimite: rbt12 > SUBLIMITE_ICMS_ISS,
    acimaDoTeto: rbt12 > TETO_SIMPLES,
  };
}

/**
 * Série de DAS para o plano (meses consecutivos desde o início de atividade).
 * `folhas[i]` = folha elegível ao Fator R no mês i (mesma janela/proporcionalização da receita).
 */
export function computeDasSeries(receitas: number[], folhas: number[]): DasMes[] {
  return receitas.map((receita, i) => {
    const rbt12 = rbt12Inicio(receitas, i);
    const folha12 = rbt12Inicio(folhas, i);
    const fatorR = rbt12 > 0 ? folha12 / rbt12 : 0;
    return computeDasMes(receita, rbt12, fatorR);
  });
}
