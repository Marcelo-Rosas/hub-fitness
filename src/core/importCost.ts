/**
 * Custo de importação porta a porta (landed cost) — modelo 4PL do Hub.
 *
 * Premissas do modelo de negócio (decisão do board, 2026-11):
 *  - IMPORTADOR = a academia (cliente), com Radar próprio. DI, proforma, commercial
 *    invoice e câmbio no CNPJ dela.
 *  - O Hub NÃO é importador, não compra, não revende e não paga o exterior. Vende só
 *    serviço (gestão, expertise logística e comercial) + armazenagem/handling 3PL.
 *    Pagamento do Hub ao fornecedor = risco de interposição fraudulenta (DL 1.455/76
 *    art. 23; Lei 10.637 art. 27). Ver `CONFORMIDADE_IMPORTACAO_DIRETA`.
 *  - Academia no Simples, compra para ativo/uso: NÃO credita II/IPI/ICMS/PIS/Cofins/
 *    IBS/CBS → todo tributo é custo.
 *
 * Origem: planilha real de consultoria (equipamentos de musculação, China). Corrigido
 * vs planilha: seguro e frete à PTAX (não "taxa armador"), AFRMM só sobre frete marítimo,
 * ICMS pela UF do importador, nenhum fator de redução de preço declarado.
 *
 * ⚠️ Alíquotas por NCM e ICMS/UF são entradas — validar com despachante. Reforma usa a
 * mesma transição de `taxReform.ts` (ICMS segue o cronograma do ISS: 90→60% 2029–32).
 */
import { DEFAULT_REFORMA, TRANSICAO, type ReformaParams } from './taxReform';

export interface ItemImportacao {
  descricao: string;
  ncm: string;
  /** Valor FOB total do item em USD (quantidade × preço unitário). */
  fobUsd: number;
  pesoKg: number;
  ii: number;
  ipi: number;
  pis: number;
  /** COFINS-Importação incluindo adicional, se a NCM tiver. */
  cofins: number;
  /** Antidumping em R$ (0 se não houver). */
  antidumpingBrl?: number;
}

export type RadarModalidade = 'expressa' | 'limitada' | 'ilimitada';
export const RADAR_LIMITE_SEMESTRE_USD: Record<RadarModalidade, number> = {
  expressa: 50_000,
  limitada: 150_000,
  ilimitada: Number.POSITIVE_INFINITY,
};

export interface ImportacaoInput {
  itens: ItemImportacao[];
  /** PTAX da data de registro da DI. */
  ptax: number;
  /** Frete internacional marítimo (remuneração do transporte) em USD — base do AFRMM. */
  freteMaritimoUsd: number;
  /** Despesas na origem até o embarque (EXW/FCA charges) em USD — entram no valor aduaneiro, não no AFRMM. */
  despesasOrigemUsd: number;
  seguroUsd: number;
  /** ICMS interno da UF do importador (academia), incluindo fundo de pobreza se houver. */
  icmsAliquota: number;
  /** Algumas UFs incluem despesas aduaneiras (capatazia etc.) na base do ICMS. */
  icmsIncluiDespesasAduaneiras: boolean;
  /** Despesas locais em R$ (terminal, desembaraço, frete rodoviário…). */
  despesas: {
    capataziaThc: number;
    armazenagemTerminal: number;
    despachante: number;
    liCertificacao: number;
    freteRodoviario: number;
    outras: number;
  };
  /**
   * Cobranças locais do agente de carga cotadas em USD (desconsolidação, handling, BL fee…),
   * pagas no destino após a chegada: não entram no valor aduaneiro, CIF/Radar nem AFRMM.
   * Planilha: "Custos Logísticos" US$ 1.700 (CONVENCIONAL!B316, cotação digitada; VALORES!F7 diz 1.900).
   */
  despesasAgenteUsd?: number;
  /**
   * Spread do câmbio do agente sobre a PTAX (agentes faturam em R$ com taxa própria).
   * Planilha usa 14% ("Taxa Armador" = PTAX × 1,14). VALIDAR com a cotação do agente.
   */
  cambioAgenteSpread?: number;
  /** Receita do Hub: gestão do processo. */
  honorarioHub: { tipo: 'fixo'; valor: number } | { tipo: 'pctFob'; pct: number };
  radar: RadarModalidade;
  /** CIF (USD) já importado pela academia no semestre corrente, antes deste processo. */
  cifSemestreAnteriorUsd: number;
  /**
   * Ano-calendário do registro da DI. ≤ 2026: regime atual. 2027+: CBS/IBS-Importação
   * substituem PIS/Cofins (e ICMS gradualmente); IPI zerado se `ipiZeraNaReforma`.
   */
  ano: number;
  /** HIPÓTESE LC 214: IPI vai a 0 em 2027 salvo produtos com industrialização na ZFM. */
  ipiZeraNaReforma: boolean;
  reforma?: ReformaParams;
}

export interface ImportacaoResultado {
  fobBrl: number;
  freteBrl: number;
  seguroBrl: number;
  valorAduaneiro: number;
  ii: number;
  ipi: number;
  pis: number;
  cofins: number;
  cbs: number;
  ibs: number;
  antidumping: number;
  afrmm: number;
  siscomex: number;
  icms: number;
  tributos: number;
  despesasLocais: number;
  /** Parte de `despesasLocais` vinda das cobranças do agente em USD. */
  despesasAgenteBrl: number;
  honorarioHub: number;
  /** Custo total para a academia (mercadoria + frete + seguro + tributos + despesas + Hub). */
  custoTotal: number;
  custoPorFob: number;
  cifUsd: number;
  radar: { limiteUsd: number; usadoAposUsd: number; excede: boolean; folgaUsd: number };
  /** Receita do Hub neste processo (entra no DAS e no Fator R). */
  receitaHub: number;
}

export const AFRMM_LONGO_CURSO = 0.08;

/** Taxa Siscomex (Portaria ME 4.131/2021): R$ 115,67 por DI + valor por adição em faixas. */
export function taxaSiscomex(adicoes: number): number {
  const faixas: [number, number][] = [
    [2, 38.56],
    [5, 30.85],
    [10, 23.14],
    [20, 15.42],
    [50, 7.71],
    [Infinity, 3.86],
  ];
  let total = 115.67;
  let anterior = 0;
  for (const [ate, valor] of faixas) {
    const n = Math.max(0, Math.min(adicoes, ate) - anterior);
    total += n * valor;
    anterior = ate;
    if (adicoes <= ate) break;
  }
  return Math.round(total * 100) / 100;
}

function fase(ano: number) {
  if (ano < 2027) return null;
  return TRANSICAO.find((f) => f.ano === Math.min(ano, 2033)) ?? null;
}

export function computeImportacao(input: ImportacaoInput): ImportacaoResultado {
  const { ptax, itens } = input;
  const rf = input.reforma ?? DEFAULT_REFORMA;
  const f = fase(input.ano);

  const fobUsd = itens.reduce((a, i) => a + i.fobUsd, 0);
  const pesoTotal = itens.reduce((a, i) => a + i.pesoKg, 0) || 1;
  const fobBrl = fobUsd * ptax;
  const freteBrl = (input.freteMaritimoUsd + input.despesasOrigemUsd) * ptax;
  const seguroBrl = input.seguroUsd * ptax;
  const afrmm = input.freteMaritimoUsd * ptax * AFRMM_LONGO_CURSO;
  const adicoes = new Set(itens.map((i) => i.ncm)).size;
  const siscomex = taxaSiscomex(adicoes);
  const despesasAgenteBrl = (input.despesasAgenteUsd ?? 0) * ptax * (1 + (input.cambioAgenteSpread ?? 0));
  const despesasLocais =
    Object.values(input.despesas).reduce((a, b) => a + b, 0) + despesasAgenteBrl;
  const despesasAduaneirasIcms = input.icmsIncluiDespesasAduaneiras
    ? input.despesas.capataziaThc + input.despesas.armazenagemTerminal
    : 0;

  let va = 0, ii = 0, ipi = 0, pis = 0, cofins = 0, antidumping = 0;
  for (const it of itens) {
    // Frete e seguro rateados por peso (critério da planilha original e da DI).
    const share = it.pesoKg / pesoTotal;
    const vaItem = it.fobUsd * ptax + (freteBrl + seguroBrl) * share;
    const iiItem = vaItem * it.ii;
    const ipiAliq = f && input.ipiZeraNaReforma ? 0 : it.ipi;
    va += vaItem;
    ii += iiItem;
    ipi += (vaItem + iiItem) * ipiAliq;
    if (!f) {
      pis += vaItem * it.pis;
      cofins += vaItem * it.cofins;
    }
    antidumping += it.antidumpingBrl ?? 0;
  }

  // IBS/CBS-Importação (LC 214): "por fora", base = VA + II + IPI + taxas + AFRMM + antidumping.
  let cbs = 0, ibs = 0;
  const icmsFracao = f ? f.issFracao : 1;
  if (f) {
    const baseIbsCbs = va + ii + ipi + afrmm + siscomex + antidumping;
    cbs = baseIbsCbs * rf.cbsRef;
    ibs = baseIbsCbs * rf.ibsRef * f.ibsFracao;
  }

  // ICMS "por dentro" (gross-up) na UF do importador, reduzido na transição 2029–2032.
  const aliqIcms = input.icmsAliquota * icmsFracao;
  const baseIcmsSem =
    va + ii + ipi + pis + cofins + afrmm + siscomex + antidumping + despesasAduaneirasIcms;
  const icms = aliqIcms > 0 ? (baseIcmsSem / (1 - aliqIcms)) * aliqIcms : 0;

  const tributos = ii + ipi + pis + cofins + cbs + ibs + antidumping + afrmm + siscomex + icms;
  const honorarioHub =
    input.honorarioHub.tipo === 'fixo' ? input.honorarioHub.valor : fobBrl * input.honorarioHub.pct;
  const custoTotal = fobBrl + freteBrl + seguroBrl + tributos + despesasLocais + honorarioHub;

  const cifUsd = fobUsd + input.freteMaritimoUsd + input.despesasOrigemUsd + input.seguroUsd;
  const limiteUsd = RADAR_LIMITE_SEMESTRE_USD[input.radar];
  const usadoAposUsd = input.cifSemestreAnteriorUsd + cifUsd;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    fobBrl: r2(fobBrl),
    freteBrl: r2(freteBrl),
    seguroBrl: r2(seguroBrl),
    valorAduaneiro: r2(va),
    ii: r2(ii),
    ipi: r2(ipi),
    pis: r2(pis),
    cofins: r2(cofins),
    cbs: r2(cbs),
    ibs: r2(ibs),
    antidumping: r2(antidumping),
    afrmm: r2(afrmm),
    siscomex,
    icms: r2(icms),
    tributos: r2(tributos),
    despesasLocais: r2(despesasLocais),
    despesasAgenteBrl: r2(despesasAgenteBrl),
    honorarioHub: r2(honorarioHub),
    custoTotal: r2(custoTotal),
    custoPorFob: custoTotal / fobBrl,
    cifUsd: r2(cifUsd),
    radar: {
      limiteUsd,
      usadoAposUsd: r2(usadoAposUsd),
      excede: usadoAposUsd > limiteUsd,
      folgaUsd: r2(limiteUsd - usadoAposUsd),
    },
    receitaHub: r2(honorarioHub),
  };
}

/** Mesma importação registrada em cada ano 2026–2033 (efeito isolado da reforma). */
export function computeImportacaoReforma(input: ImportacaoInput) {
  return [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((ano) => ({
    ano,
    r: computeImportacao({ ...input, ano }),
  }));
}

/** Checklist de conformidade — importação direta pela academia com Hub como prestador. */
export const CONFORMIDADE_IMPORTACAO_DIRETA: { id: string; item: string }[] = [
  { id: 'proforma', item: 'Proforma e commercial invoice em nome da academia (CNPJ importador).' },
  { id: 'cambio', item: 'Câmbio (sinal 30% e saldo 70%) fechado pela academia, em banco dela.' },
  { id: 'di', item: 'DI/DUIMP registrada no CNPJ da academia, com Radar próprio dentro do limite.' },
  { id: 'sem-recursos-hub', item: 'Hub não paga fornecedor, frete internacional nem tributos com recursos próprios.' },
  { id: 'contrato', item: 'Contrato do Hub = prestação de serviço (gestão/consultoria); sem promessa de entrega de mercadoria.' },
  { id: 'nf-servico', item: 'Hub fatura só NFS-e de serviço; nenhuma NF de venda de mercadoria.' },
  { id: 'valor-real', item: 'Preço declarado = preço real pago ao fornecedor (sem fator de redução / pagamento por fora).' },
  { id: 'despachante', item: 'Desembaraço por despachante credenciado ou preposto da academia.' },
];

/** Simulação real da planilha (CONVENCIONAL), com os valores de entrada corrigidos. */
export const SIMULACAO_REFERENCIA: ImportacaoInput = {
  itens: [
    {
      descricao: 'Equipamentos de musculação (consolidado)',
      ncm: '9506.91.00',
      fobUsd: 40_305,
      pesoKg: 13_165,
      ii: 0.18,
      ipi: 0.13,
      pis: 0.021,
      cofins: 0.1045,
    },
  ],
  ptax: 5.18,
  freteMaritimoUsd: 4_500,
  despesasOrigemUsd: 500,
  seguroUsd: 109,
  icmsAliquota: 0.17,
  icmsIncluiDespesasAduaneiras: false,
  despesas: {
    capataziaThc: 1_400,
    armazenagemTerminal: 4_000,
    despachante: 3_000,
    liCertificacao: 0,
    freteRodoviario: 3_000,
    outras: 800,
  },
  despesasAgenteUsd: 1_700,
  cambioAgenteSpread: 0.14,
  honorarioHub: { tipo: 'fixo', valor: 25_000 },
  radar: 'expressa',
  cifSemestreAnteriorUsd: 0,
  ano: 2026,
  ipiZeraNaReforma: true,
};
