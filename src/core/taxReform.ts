/**
 * Reforma Tributária do consumo (EC 132/2023 + LC 214/2025) — cenários para o Hub.
 *
 * Método: operação ESTÁTICA (DRE do Ano 2 do plano, anualizada) submetida ao regime
 * tributário de cada ano-calendário 2027–2033. Isola o efeito da reforma do efeito
 * de crescimento. Valores em R$/ano.
 *
 * Regimes comparados:
 *  - simples  : Simples "por dentro" — CBS/IBS dentro do DAS. Total do DAS ≈ inalterado;
 *               cliente só credita a parcela CBS/IBS do DAS.
 *  - hibrido  : Simples com IBS/CBS pelo regime regular (LC 214 art. 41). DAS sem
 *               PIS/Cofins (e sem a fração do ISS já substituída por IBS); IBS/CBS por fora,
 *               débito − crédito. Cliente credita IBS/CBS cheio.
 *  - presumido: referência (obrigatório acima de R$ 4,8 mi). IRPJ/CSLL presumidos,
 *               INSS patronal sobre folha, IBS/CBS regular.
 *
 * Preço: `receita` = valor que o Hub retém, sem IBS/CBS. No regime regular IBS/CBS é
 * "por fora": clientes que creditam têm custo líquido = receita; para manter o preço
 * bruto dos clientes que NÃO creditam (PF, Simples por dentro), o Hub absorve o tributo.
 *
 * ⚠️ Alíquotas de referência CBS/IBS são estimativas oficiais ainda sujeitas a ajuste
 * (calibração anual pelo Senado/TCU). Tudo marcado HIPÓTESE deve ser validado por contador.
 */
import { tabelaAnexo, faixaIndex, type SimplesAnexo } from './simplesNacional';
import type { DreMonth } from '../types';

export type RegimeReforma = 'simples' | 'hibrido' | 'presumido';

export interface ReformaParams {
  /** HIPÓTESE — alíquota de referência CBS (federal). */
  cbsRef: number;
  /** HIPÓTESE — alíquota de referência IBS (estadual + municipal). */
  ibsRef: number;
  /**
   * HIPÓTESE — fração da receita vinda de clientes que aproveitam crédito (Lucro Real/Presumido
   * ou Simples híbrido). ICP = academias no Simples por dentro (vendem a PF) → não creditam.
   */
  clientesCreditoPct: number;
  /** HIPÓTESE — fração de (custos + despesas − folha) adquirida com IBS/CBS creditável. */
  insumosCreditaveisPct: number;
}

export const DEFAULT_REFORMA: ReformaParams = {
  cbsRef: 0.088,
  ibsRef: 0.177,
  // ICP academias Simples Nacional: maioria não credita. 10% = distribuidores/redes grandes.
  clientesCreditoPct: 0.1,
  insumosCreditaveisPct: 0.6,
};

/** Fase de transição por ano-calendário (EC 132, art. 125–133 ADCT). */
export interface FaseAno {
  ano: number;
  /** Fração da alíquota de referência do IBS vigente. */
  ibsFracao: number;
  /** Fração do ISS ainda vigente (1 = cheio; 0 = extinto). */
  issFracao: number;
  /** PIS/Cofins vigentes? (extintos em 2027). */
  pisCofins: boolean;
  nota: string;
}

/** IBS 0,1% em 2027–2028 (teste); 2029–2032 ISS a 9/10…6/10 e IBS cresce; 2033 pleno. */
export const TRANSICAO: FaseAno[] = [
  { ano: 2027, ibsFracao: 0.001 / 0.177, issFracao: 1, pisCofins: false, nota: 'CBS plena; PIS/Cofins extintos; IBS 0,1%' },
  { ano: 2028, ibsFracao: 0.001 / 0.177, issFracao: 1, pisCofins: false, nota: 'Igual 2027' },
  { ano: 2029, ibsFracao: 0.1, issFracao: 0.9, pisCofins: false, nota: 'ISS/ICMS 90%; IBS 10%' },
  { ano: 2030, ibsFracao: 0.2, issFracao: 0.8, pisCofins: false, nota: 'ISS/ICMS 80%; IBS 20%' },
  { ano: 2031, ibsFracao: 0.3, issFracao: 0.7, pisCofins: false, nota: 'ISS/ICMS 70%; IBS 30%' },
  { ano: 2032, ibsFracao: 0.4, issFracao: 0.6, pisCofins: false, nota: 'ISS/ICMS 60%; IBS 40%' },
  { ano: 2033, ibsFracao: 1, issFracao: 0, pisCofins: false, nota: 'Só IBS/CBS; ISS/ICMS extintos' },
];

/** Base anual da operação (do DRE ao vivo). */
export interface BaseAnual {
  receita: number;
  custos: number;
  despesas: number;
  /** DAS anual do Simples atual (tabela LC 123). */
  das: number;
  /** Folha + pró-labore + encargos (numerador do Fator R). Não gera crédito de IBS/CBS. */
  folha: number;
  rbt12: number;
  anexo: SimplesAnexo;
}

export interface ResultadoRegime {
  regime: RegimeReforma;
  ano: number;
  /** Receita retida pelo Hub (sem IBS/CBS por fora). */
  receitaRetida: number;
  /** DAS (Simples/híbrido) ou IRPJ+CSLL+INSS patronal (presumido). */
  tributosRenda: number;
  /** ISS fora do DAS (só presumido, enquanto vigente). */
  iss: number;
  /** IBS/CBS recolhido por fora = débito − crédito (repassado ao cliente; informativo). */
  ibsCbsRecolhido: number;
  /** Crédito de IBS/CBS sobre insumos (reduz custo no regime regular). */
  creditoInsumos: number;
  /** Carga que sai do resultado do Hub = (receita bruta − retida) + tributos − créditos. */
  cargaTotal: number;
  cargaPctReceita: number;
  lucroLiquido: number;
  /** Crédito de IBS/CBS por R$ 100 de custo líquido para cliente creditante. */
  creditoClientePor100: number;
}

function reparticao(b: BaseAnual) {
  return tabelaAnexo(b.anexo)[faixaIndex(b.rbt12, b.anexo)].reparticao;
}

/**
 * Premissa de preço (neutralidade competitiva): o custo do cliente é o MESMO em todos os
 * regimes, ancorado no Simples por dentro:
 *  - cliente creditante: custo líquido = receita − crédito que ele já tinha no Simples;
 *  - cliente não creditante: preço bruto = receita (o Hub absorve o IBS/CBS por fora).
 * Assim a diferença de lucro entre regimes é só tributária.
 */
export function computeRegimeAno(
  regime: RegimeReforma,
  fase: FaseAno,
  b: BaseAnual,
  p: ReformaParams = DEFAULT_REFORMA,
): ResultadoRegime {
  const r = reparticao(b);
  const t = p.cbsRef + p.ibsRef * fase.ibsFracao;
  const a = p.clientesCreditoPct;
  // Parcela "consumo" do DAS: ex-PIS/Cofins (→ CBS) + fração do ISS já migrada para IBS.
  const parcelaConsumo = r.pis + r.cofins + r.iss * (1 - fase.issFracao);
  const creditoSimples = b.das * parcelaConsumo; // crédito total que clientes teriam no Simples
  const operacional = b.custos + b.despesas;

  if (regime === 'simples') {
    const lucro = b.receita - operacional - b.das;
    return {
      regime, ano: fase.ano,
      receitaRetida: Math.round(b.receita),
      tributosRenda: Math.round(b.das), iss: 0, ibsCbsRecolhido: 0, creditoInsumos: 0,
      cargaTotal: Math.round(b.das), cargaPctReceita: b.das / b.receita,
      lucroLiquido: Math.round(lucro),
      creditoClientePor100: Number(((100 * creditoSimples) / (b.receita - creditoSimples)).toFixed(2)),
    };
  }

  // Regime regular de IBS/CBS (híbrido e presumido).
  const retidaCreditantes = a * (b.receita - creditoSimples);
  const retidaNaoCreditantes = ((1 - a) * b.receita) / (1 + t);
  const receitaRetida = retidaCreditantes + retidaNaoCreditantes;
  // Ledger = valores pagos aos fornecedores (bruto). Crédito = parcela de IBS/CBS embutida.
  const baseCreditavel = Math.max(0, operacional - b.folha) * p.insumosCreditaveisPct;
  const creditoInsumos = (baseCreditavel * t) / (1 + t);
  const ibsCbsRecolhido = Math.max(0, receitaRetida * t - creditoInsumos);

  let tributosRenda: number;
  let iss = 0;
  if (regime === 'hibrido') {
    // DAS sem PIS/Cofins e sem a fração do ISS substituída por IBS.
    tributosRenda = b.das * (r.irpj + r.csll + r.cpp + r.iss * fase.issFracao);
  } else {
    // Lucro Presumido — serviços: presunção 32%; adicional IRPJ 10% acima de R$ 240 mil/ano.
    const presumido = receitaRetida * 0.32;
    const irpj = presumido * 0.15 + Math.max(0, presumido - 240_000) * 0.1;
    const csll = presumido * 0.09;
    // HIPÓTESE: folha do ledger já inclui FGTS 8%; INSS patronal + RAT + terceiros ≈ 27,8%.
    const inss = (b.folha / 1.08) * 0.278;
    tributosRenda = irpj + csll + inss;
    iss = receitaRetida * 0.05 * fase.issFracao; // HIPÓTESE ISS 5% Itajaí — confirmar
  }

  const lucro = receitaRetida - operacional + creditoInsumos - tributosRenda - iss;
  const carga = b.receita - receitaRetida + tributosRenda + iss - creditoInsumos;
  return {
    regime, ano: fase.ano,
    receitaRetida: Math.round(receitaRetida),
    tributosRenda: Math.round(tributosRenda),
    iss: Math.round(iss),
    ibsCbsRecolhido: Math.round(ibsCbsRecolhido),
    creditoInsumos: Math.round(creditoInsumos),
    cargaTotal: Math.round(carga),
    cargaPctReceita: carga / b.receita,
    lucroLiquido: Math.round(lucro),
    creditoClientePor100: Number((100 * t).toFixed(2)),
  };
}

export function computeReformaSeries(b: BaseAnual, p: ReformaParams = DEFAULT_REFORMA) {
  return TRANSICAO.map((fase) => ({
    fase,
    simples: computeRegimeAno('simples', fase, b, p),
    hibrido: computeRegimeAno('hibrido', fase, b, p),
    presumido: computeRegimeAno('presumido', fase, b, p),
  }));
}

/**
 * % mínimo de receita vinda de clientes creditantes para o híbrido empatar com o
 * Simples por dentro no ano dado (busca binária; null se nunca empata em 0–100%).
 */
export function breakevenClientesCredito(
  b: BaseAnual,
  ano: number,
  p: ReformaParams = DEFAULT_REFORMA,
): number | null {
  const fase = TRANSICAO.find((f) => f.ano === ano);
  if (!fase) return null;
  const diff = (alpha: number) =>
    computeRegimeAno('hibrido', fase, b, { ...p, clientesCreditoPct: alpha }).lucroLiquido -
    computeRegimeAno('simples', fase, b, p).lucroLiquido;
  if (diff(1) < 0) return null;
  if (diff(0) >= 0) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (diff(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Obrigações/decisões imediatas para o modelo de negócio (status: validar com contador). */
export interface ObrigacaoReforma {
  id: string;
  quando: string;
  item: string;
  impacto: string;
  confianca: 'lei' | 'regulamento' | 'validar';
}

export const OBRIGACOES_REFORMA: ObrigacaoReforma[] = [
  {
    id: 'abertura-regime',
    quando: 'Na abertura do CNPJ',
    item: 'Escolher Simples "por dentro" ou híbrido (IBS/CBS regular). Depois: janelas semestrais.',
    impacto: 'Define se clientes B2B creditam IBS/CBS cheio. Opção é irretratável no semestre.',
    confianca: 'validar',
  },
  {
    id: 'nfse-nacional',
    quando: 'Desde 2026',
    item: 'NFS-e padrão nacional com campos IBS/CBS (destaque informativo em 2026).',
    impacto: 'ERP/WMS precisa emitir NFS-e nacional; Itajaí deve estar aderente.',
    confianca: 'regulamento',
  },
  {
    id: 'cbs-2027',
    quando: '01/2027',
    item: 'CBS plena; PIS/Cofins extintos. IBS 0,1% (2027–2028).',
    impacto: 'Precificação por fora no regime regular; contratos devem prever cláusula de repasse de tributo.',
    confianca: 'lei',
  },
  {
    id: 'split-payment',
    quando: 'A partir de 2027 (gradual)',
    item: 'Split payment: IBS/CBS retidos na liquidação financeira.',
    impacto: 'Capital de giro: imposto não transita pelo caixa do Hub. Afeta projeção de caixa no híbrido.',
    confianca: 'validar',
  },
  {
    id: 'transicao-iss',
    quando: '2029–2032',
    item: 'ISS cai 10 p.p./ano; IBS sobe na mesma proporção. 2033: só IBS/CBS.',
    impacto: 'Repartição do DAS muda todo ano; reprecificar contratos plurianuais.',
    confianca: 'lei',
  },
  {
    id: 'armazem-geral',
    quando: 'Antes de operar',
    item: 'Matrícula de Armazém Geral na Junta Comercial (Decreto 1.102/1903) + inscrição estadual SC.',
    impacto: 'Notas de remessa/retorno para armazenagem; confirmar CNAE 5211-7/01 no Simples.',
    confianca: 'validar',
  },
  {
    id: 'contratos-clausula',
    quando: 'Antes do 1º contrato',
    item: 'Cláusula de reequilíbrio tributário (reforma) nos contratos de 3PL de 24–60 meses.',
    impacto: 'Sem ela o Hub absorve a mudança de carga 2029–2033.',
    confianca: 'validar',
  },
];

/**
 * Base anual = Ano 2 do plano (M13–M24), operação em cruzeiro.
 * `folhaMensal[i]` = folha elegível ao Fator R do mês i (mesmo índice de `months`).
 */
export function baseAnualFromDre(months: DreMonth[], folhaMensal: number[]): BaseAnual {
  const idx = months.map((_, i) => i).filter((i) => months[i].month >= 13 && months[i].month <= 24);
  const sel = idx.length ? idx : months.map((_, i) => i).slice(-12);
  const sum = (f: (i: number) => number) => sel.reduce((a, i) => a + f(i), 0);
  const last = months[sel[sel.length - 1]];
  return {
    receita: sum((i) => months[i].receitaServicos),
    custos: sum((i) => months[i].custosOperacionais),
    despesas: sum((i) => months[i].despesasOperacionais),
    das: sum((i) => months[i].das6Percent),
    folha: sum((i) => folhaMensal[i] ?? 0),
    rbt12: last?.simples?.rbt12 ?? sum((i) => months[i].receitaServicos),
    anexo: last?.simples?.anexo ?? 'III',
  };
}
