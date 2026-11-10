/**
 * ICMS por UF + programas estaduais de incentivo à importação (via trading).
 *
 * Alíquotas internas modais 2026 (consenso Paggo / NSDocs, mai–nov 2026). Fontes divergem em
 * MA, MS, BA, RO, PI, PR, SE → `validar: true`. Equipamento de musculação segue a modal salvo
 * redução de base específica do estado (validar por NCM).
 *
 * ⚠️ Programas: parâmetros são HIPÓTESES de mercado (fontes comerciais, não texto legal).
 * Servem para simular ordem de grandeza; cada número deve ser confirmado com a SEFAZ/tributarista.
 *
 * Regras jurídicas que o motor respeita:
 *  - STF Tema 520 (ARE 665.134): sujeito ativo do ICMS-importação = UF do destinatário
 *    JURÍDICO. Conta e ordem → UF do adquirente (academia). Encomenda/própria → UF da trading.
 *    O estado do porto/desembaraço NÃO define o ICMS.
 *  - Res. Senado 13/2012: interestadual com importado (CI > 40%) = 4%, qualquer modalidade
 *    e qualquer regime do comprador. Exceção: bens sem similar nacional (lista CAMEX).
 *  - EC 87/2015 + LC 190/2022: DIFAL ao destino (não contribuinte: remetente recolhe, base única;
 *    contribuinte p/ ativo: destinatário recolhe, base dupla).
 *  - EC 132: benefícios de ICMS extintos com o ICMS em 2033.
 */

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export type UF = (typeof UFS)[number];

export interface IcmsUf {
  interna: number;
  /** Fundo de combate à pobreza aplicado à modal (não só a supérfluos). */
  fcp: number;
  validar?: boolean;
  nota?: string;
}

export const ICMS_UF: Record<UF, IcmsUf> = {
  AC: { interna: 0.19, fcp: 0 },
  AL: { interna: 0.205, fcp: 0.01, nota: 'Lei 5.900/96 red. Lei 9.776/2025, desde 01/04/2026' },
  AP: { interna: 0.18, fcp: 0 },
  AM: { interna: 0.2, fcp: 0 },
  BA: { interna: 0.205, fcp: 0, validar: true, nota: 'fontes: 20,5% / 19%' },
  CE: { interna: 0.2, fcp: 0 },
  DF: { interna: 0.2, fcp: 0 },
  ES: { interna: 0.17, fcp: 0 },
  GO: { interna: 0.19, fcp: 0 },
  MA: { interna: 0.23, fcp: 0, validar: true, nota: 'fontes: 23% / 20%' },
  MT: { interna: 0.17, fcp: 0 },
  MS: { interna: 0.17, fcp: 0, validar: true, nota: 'fontes: 17% / 19%' },
  MG: { interna: 0.18, fcp: 0 },
  PA: { interna: 0.19, fcp: 0 },
  PB: { interna: 0.2, fcp: 0 },
  PR: { interna: 0.195, fcp: 0, validar: true },
  PE: { interna: 0.205, fcp: 0 },
  PI: { interna: 0.225, fcp: 0, validar: true, nota: 'fontes: 22,5% / 21%' },
  RJ: { interna: 0.2, fcp: 0.02, nota: 'FECP 2%' },
  RN: { interna: 0.2, fcp: 0 },
  RS: { interna: 0.17, fcp: 0 },
  RO: { interna: 0.195, fcp: 0, validar: true, nota: 'fontes: 19,5% / 17,5%' },
  RR: { interna: 0.2, fcp: 0 },
  SC: { interna: 0.17, fcp: 0 },
  SP: { interna: 0.18, fcp: 0 },
  SE: { interna: 0.19, fcp: 0.01, validar: true, nota: 'FECOEP 1%' },
  TO: { interna: 0.2, fcp: 0 },
};

export const aliqInterna = (uf: UF) => ICMS_UF[uf].interna + ICMS_UF[uf].fcp;

/** Alíquota interestadual para importado com conteúdo de importação > 40%. */
export const ALIQ_INTERESTADUAL_IMPORTADO = 0.04;

export interface ProgramaImportacao {
  id: string;
  uf: UF;
  nome: string;
  /**
   * HIPÓTESE — ICMS efetivamente recolhido pela trading na saída interestadual, como fração
   * do valor da operação (destaque 4% − crédito presumido). ICMS-importação diferido.
   */
  cargaEfetiva: number;
  /** Desembaraço precisa ocorrer em porto/aeroporto/fronteira da própria UF? */
  desembaracoNaUf: 'sim' | 'nao' | 'parcial' | 'incerto';
  base: string;
  nota: string;
}

export const PROGRAMAS_IMPORTACAO: ProgramaImportacao[] = [
  {
    id: 'sc-ttd',
    uf: 'SC',
    nome: 'TTD 409/410 (Santa Catarina)',
    cargaEfetiva: 0.026,
    desembaracoNaUf: 'sim',
    base: 'RICMS/SC Anexo 2; COPAT 36/2022, 13/2022, 19/2026, 25/2026',
    nota: 'Carga efetiva 0,6–2,6% conforme TTD/fundos (usado o teto). Exige portos/aeroportos/fronteira em SC (mín. 30% em alguns termos). Itajaí/Navegantes/Itapoá/SFS = porta do Hub.',
  },
  {
    id: 'al',
    uf: 'AL',
    nome: 'Regime de importação de Alagoas',
    cargaEfetiva: 0.015,
    desembaracoNaUf: 'incerto',
    base: 'Dec. AL 3.988/2008 (encomenda/conta e ordem); fontes comerciais',
    nota: 'Fontes conflitam: "nacionalização em AL" × "qualquer porto com entrada simbólica". Carga hipotética. Planilha da consultoria usa AL.',
  },
  {
    id: 'es-invest',
    uf: 'ES',
    nome: 'INVEST-Importação + COMPETE-ES',
    cargaEfetiva: 0.012,
    desembaracoNaUf: 'incerto',
    base: 'Fontes comerciais: diferimento 100% + crédito presumido até 70% na saída interestadual',
    nota: '4% × (1 − 70%) ≈ 1,2%. Exige estabelecimento habilitado no ES.',
  },
  {
    id: 'go-comex',
    uf: 'GO',
    nome: 'COMEXPRODUZIR (Goiás)',
    cargaEfetiva: 0.014,
    desembaracoNaUf: 'incerto',
    base: 'Lei GO 14.186/2002; crédito outorgado ≈ 65% na saída interestadual (validar)',
    nota: '4% × 35% ≈ 1,4%. GO não tem porto marítimo: desembaraço em porto seco (Anápolis) ou outra UF.',
  },
  {
    id: 'pe-prodepe',
    uf: 'PE',
    nome: 'PRODEPE Importação (Pernambuco)',
    cargaEfetiva: 0.021,
    desembaracoNaUf: 'incerto',
    base: 'Fontes comerciais: crédito presumido 47,5% saída interestadual',
    nota: '4% × 52,5% ≈ 2,1%.',
  },
  {
    id: 'mg-corredor',
    uf: 'MG',
    nome: 'Corredor de Importação (Minas Gerais)',
    cargaEfetiva: 0.02,
    desembaracoNaUf: 'parcial',
    base: 'Dec. MG 46.980/2016; Dec. 48.589/2023 Anexos VI e VIII; regime especial (SIARE)',
    nota: 'Desembaraço em MG, exceto autorização em regime especial para outra UF (acórdão CC/MG desqualificou Guarulhos sem autorização). Carga hipotética.',
  },
];

export const programaPorId = (id: string) => PROGRAMAS_IMPORTACAO.find((p) => p.id === id);
