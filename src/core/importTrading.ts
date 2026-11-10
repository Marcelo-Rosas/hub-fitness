/**
 * Comparador por UF: importação direta (modelo Hub) × trading (conta e ordem / encomenda).
 *
 * Cenários para a academia (Simples, compra p/ ativo, não credita nada):
 *  - 'direta'          academia importa com Radar próprio; ICMS-importação à alíquota interna da
 *                      UF dela; Hub cobra honorário de gestão. (= `computeImportacao`)
 *  - 'contaOrdem'      trading importa por conta e ordem. Tema 520: ICMS-importação é da UF da
 *                      academia, alíquota interna → incentivo da trading NÃO se aplica.
 *                      Custo = direta − honorário Hub + honorário trading.
 *  - 'encomenda'       trading importa em nome próprio na UF incentivada, ICMS diferido, revende
 *                      a 4% interestadual com crédito presumido. Academia paga DIFAL ao destino.
 *                      Trading (Lucro Real) credita PIS/Cofins/IPI/CBS/IBS de entrada e debita
 *                      na saída sobre o valor maior.
 *  - 'contaOrdemAgressiva' mesma conta do ICMS da encomenda numa conta e ordem: contraria o
 *                      Tema 520; risco de autuação pela UF da academia (ICMS integral + multa).
 *
 * Trading em UF = UF da academia é excluída (operação interna: sem 4%, sem incentivo de saída).
 */
import {
  ALIQ_INTERESTADUAL_IMPORTADO,
  aliqInterna,
  PROGRAMAS_IMPORTACAO,
  UFS,
  type ProgramaImportacao,
  type UF,
} from './icmsUf';
import { computeImportacao, type ImportacaoInput } from './importCost';
import { DEFAULT_REFORMA, TRANSICAO } from './taxReform';

export interface TradingParams {
  /** Honorário da trading sobre o valor aduaneiro (HIPÓTESE mercado 1–3%). */
  feeTradingPctVa: number;
  /** Fração do ganho do incentivo (4% − carga efetiva) que a trading devolve no preço. */
  repasseBeneficio: number;
  /** Academia contribuinte do ICMS (tem IE)? Academia típica = não (presta serviço, ISS). */
  academiaContribuinte: boolean;
  /** PIS+Cofins não cumulativos da trading na saída (2026). */
  pisCofinsSaida: number;
}

export const DEFAULT_TRADING: TradingParams = {
  feeTradingPctVa: 0.02,
  // Teto otimista para a trading: devolve tudo. Se a direta ainda ganhar, o argumento é robusto.
  repasseBeneficio: 1,
  academiaContribuinte: false,
  pisCofinsSaida: 0.0925,
};

export type CenarioTrading = 'direta' | 'contaOrdem' | 'encomenda' | 'contaOrdemAgressiva';

export interface ResultadoCenario {
  cenario: CenarioTrading;
  custoTotal: number;
  /** Custo sem honorário do intermediário (Hub ou trading): isola o efeito tributário. */
  custoSemIntermediario: number;
  /** ICMS que onera a academia (importação ou destaque + DIFAL). */
  icmsTotal: number;
  icmsUfAcademia: number;
  icmsUfTrading: number;
  difal: number;
  feeIntermediario: number;
  /** Radar da academia consumido? (conta e ordem: adquirente também se habilita — validar limite). */
  usaRadarAcademia: boolean;
  risco?: string;
}

function fase(ano: number) {
  if (ano < 2027) return null;
  return TRANSICAO.find((f) => f.ano === Math.min(ano, 2033)) ?? null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Encomenda (e variante agressiva da conta e ordem): ICMS diferido + saída interestadual 4%. */
function saidaInterestadual(
  input: ImportacaoInput,
  ufAcademia: UF,
  prog: ProgramaImportacao,
  t: TradingParams,
  creditaFederais: boolean,
) {
  const f = fase(input.ano);
  const rf = input.reforma ?? DEFAULT_REFORMA;
  const icmsFr = f ? f.issFracao : 1;
  const imp = computeImportacao({ ...input, icmsAliquota: 0, honorarioHub: { tipo: 'fixo', valor: 0 } });
  const fee = imp.valorAduaneiro * t.feeTradingPctVa;

  // Custo da trading sem ICMS; tributos federais creditáveis saem da base se ela credita.
  const creditos = creditaFederais ? imp.pis + imp.cofins + imp.ipi + imp.cbs + imp.ibs : 0;
  const base = imp.custoTotal - creditos + fee;

  const a4 = ALIQ_INTERESTADUAL_IMPORTADO * icmsFr;
  const pc = creditaFederais && !f ? t.pisCofinsSaida : 0;
  const valorNf = base / (1 - a4 - pc); // ICMS e PIS/Cofins "por dentro"
  const icmsDestacado = valorNf * a4;
  const icmsPagoTrading = valorNf * prog.cargaEfetiva * icmsFr;
  const repasse = (icmsDestacado - icmsPagoTrading) * t.repasseBeneficio;

  const fob = input.itens.reduce((a, i) => a + i.fobUsd, 0) || 1;
  const ipiMedio = input.itens.reduce((a, i) => a + i.ipi * i.fobUsd, 0) / fob;
  const ipiSaida = creditaFederais ? valorNf * (f && input.ipiZeraNaReforma ? 0 : ipiMedio) : 0;
  const ibsCbsSaida =
    creditaFederais && f ? (valorNf - icmsDestacado) * (rf.cbsRef + rf.ibsRef * f.ibsFracao) : 0;

  const interna = aliqInterna(ufAcademia) * icmsFr;
  const difal = t.academiaContribuinte
    ? ((valorNf - icmsDestacado) / (1 - interna)) * interna - icmsDestacado // base dupla
    : valorNf * (interna - a4); // base única (EC 87)

  return {
    custoTotal: valorNf - repasse + ipiSaida + ibsCbsSaida + Math.max(0, difal),
    icmsDestacado,
    icmsPagoTrading,
    difal: Math.max(0, difal),
    fee,
  };
}

export function compararCenarios(
  input: ImportacaoInput,
  ufAcademia: UF,
  prog: ProgramaImportacao,
  t: TradingParams = DEFAULT_TRADING,
): ResultadoCenario[] {
  if (prog.uf === ufAcademia) throw new Error('Trading na mesma UF da academia: fora do escopo');
  const interna = aliqInterna(ufAcademia);
  const direta = computeImportacao({ ...input, icmsAliquota: interna });
  const fee = direta.valorAduaneiro * t.feeTradingPctVa;

  const enc = saidaInterestadual(input, ufAcademia, prog, t, true);
  const agr = saidaInterestadual(input, ufAcademia, prog, t, false);
  const t0 = { ...t, feeTradingPctVa: 0 };
  const enc0 = saidaInterestadual(input, ufAcademia, prog, t0, true).custoTotal;
  const agr0 = saidaInterestadual(input, ufAcademia, prog, t0, false).custoTotal;
  const direta0 = direta.custoTotal - direta.honorarioHub;

  return [
    {
      cenario: 'direta',
      custoTotal: r2(direta.custoTotal),
      custoSemIntermediario: r2(direta0),
      icmsTotal: direta.icms,
      icmsUfAcademia: direta.icms,
      icmsUfTrading: 0,
      difal: 0,
      feeIntermediario: direta.honorarioHub,
      usaRadarAcademia: true,
    },
    {
      cenario: 'contaOrdem',
      custoTotal: r2(direta0 + fee),
      custoSemIntermediario: r2(direta0),
      icmsTotal: direta.icms,
      icmsUfAcademia: direta.icms,
      icmsUfTrading: 0,
      difal: 0,
      feeIntermediario: r2(fee),
      usaRadarAcademia: true,
    },
    {
      cenario: 'encomenda',
      custoTotal: r2(enc.custoTotal),
      custoSemIntermediario: r2(enc0),
      icmsTotal: r2(enc.icmsPagoTrading + enc.difal),
      icmsUfAcademia: r2(enc.difal),
      icmsUfTrading: r2(enc.icmsPagoTrading),
      difal: r2(enc.difal),
      feeIntermediario: r2(enc.fee),
      usaRadarAcademia: false,
    },
    {
      cenario: 'contaOrdemAgressiva',
      custoTotal: r2(agr.custoTotal),
      custoSemIntermediario: r2(agr0),
      icmsTotal: r2(agr.icmsPagoTrading + agr.difal),
      icmsUfAcademia: r2(agr.difal),
      icmsUfTrading: r2(agr.icmsPagoTrading),
      difal: r2(agr.difal),
      feeIntermediario: r2(agr.fee),
      usaRadarAcademia: true,
      risco: `Tema 520: ICMS-importação devido a ${ufAcademia} à alíquota interna; autuação provável.`,
    },
  ];
}

export interface LinhaMatriz {
  uf: UF;
  aliqInterna: number;
  direta: number;
  contaOrdem: number;
  encomenda: number;
  /** encomenda − direta (negativo = trading mais barata), com honorários. */
  deltaEncomenda: number;
  /** Idem, só efeito tributário (sem honorário Hub nem trading). */
  deltaTributario: number;
}

/** Todas as UFs de destino (exceto a do programa) para um programa e ano. */
export function matrizUfs(
  input: ImportacaoInput,
  progId: string,
  t: TradingParams = DEFAULT_TRADING,
): LinhaMatriz[] {
  const prog = PROGRAMAS_IMPORTACAO.find((p) => p.id === progId);
  if (!prog) throw new Error(`programa ${progId} desconhecido`);
  return UFS.filter((uf) => uf !== prog.uf).map((uf) => {
    const c = compararCenarios(input, uf, prog, t);
    const row = (k: CenarioTrading) => c.find((x) => x.cenario === k)!;
    const get = (k: CenarioTrading) => row(k).custoTotal;
    return {
      uf,
      aliqInterna: aliqInterna(uf),
      direta: get('direta'),
      contaOrdem: get('contaOrdem'),
      encomenda: get('encomenda'),
      deltaEncomenda: r2(get('encomenda') - get('direta')),
      deltaTributario: r2(row('encomenda').custoSemIntermediario - row('direta').custoSemIntermediario),
    };
  });
}
