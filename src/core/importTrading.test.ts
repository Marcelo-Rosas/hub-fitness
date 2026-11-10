import { describe, expect, it } from 'vitest';
import { aliqInterna, ICMS_UF, programaPorId, UFS } from './icmsUf';
import { SIMULACAO_REFERENCIA as REF } from './importCost';
import { compararCenarios, DEFAULT_TRADING, matrizUfs } from './importTrading';

const SC = programaPorId('sc-ttd')!;
const cen = (uf: Parameters<typeof compararCenarios>[1], t = DEFAULT_TRADING, input = REF) =>
  Object.fromEntries(compararCenarios(input, uf, SC, t).map((c) => [c.cenario, c]));

describe('tabela UF', () => {
  it('27 UFs, modal entre 17% e 23%; RJ 22% com FECP', () => {
    expect(UFS).toHaveLength(27);
    for (const uf of UFS) expect(ICMS_UF[uf].interna).toBeGreaterThanOrEqual(0.17);
    expect(aliqInterna('RJ')).toBeCloseTo(0.22, 4);
  });
});

describe('cenários', () => {
  it('trading na mesma UF da academia é recusada', () => {
    expect(() => compararCenarios(REF, 'SC', SC)).toThrow();
  });
  it('matriz cobre 26 UFs (exclui UF do programa)', () => {
    const m = matrizUfs(REF, 'sc-ttd');
    expect(m).toHaveLength(26);
    expect(m.some((x) => x.uf === 'SC')).toBe(false);
  });
  it('conta e ordem (Tema 520): ICMS = o da importação direta na UF da academia', () => {
    const c = cen('SP');
    expect(c.contaOrdem.icmsTotal).toBe(c.direta.icmsTotal);
    expect(c.contaOrdem.custoSemIntermediario).toBe(c.direta.custoSemIntermediario);
  });
  it('encomenda: academia paga só DIFAL e não usa Radar', () => {
    const c = cen('SP');
    expect(c.encomenda.icmsUfAcademia).toBe(c.encomenda.difal);
    expect(c.encomenda.usaRadarAcademia).toBe(false);
  });
  it('efeito tributário da encomenda é pequeno (<2% do custo) mesmo repassando 100% do incentivo', () => {
    const c = cen('SP');
    const d = c.encomenda.custoSemIntermediario - c.direta.custoSemIntermediario;
    expect(Math.abs(d) / c.direta.custoSemIntermediario).toBeLessThan(0.02);
  });
  it('sem repasse do incentivo, encomenda encarece', () => {
    const com = cen('SP').encomenda.custoTotal;
    const sem = cen('SP', { ...DEFAULT_TRADING, repasseBeneficio: 0 }).encomenda.custoTotal;
    expect(sem).toBeGreaterThan(com);
  });
  it('UF com alíquota interna maior custa mais na direta', () => {
    expect(cen('MA').direta.custoTotal).toBeGreaterThan(cen('RS').direta.custoTotal);
  });
  it('variante agressiva carrega risco Tema 520', () => {
    expect(cen('RJ').contaOrdemAgressiva.risco).toMatch(/Tema 520/);
  });
});

describe('alíquota interestadual e DIFAL', () => {
  it('importado 4%; lista CAMEX: 7% S/SE→N/NE/CO/ES, 12% demais', async () => {
    const { aliqInterestadual } = await import('./icmsUf');
    expect(aliqInterestadual('SC', 'RJ')).toBe(0.04);
    expect(aliqInterestadual('SC', 'RJ', false)).toBe(0.12);
    expect(aliqInterestadual('SC', 'BA', false)).toBe(0.07);
    expect(aliqInterestadual('SC', 'ES', false)).toBe(0.07);
    expect(aliqInterestadual('ES', 'SP', false)).toBe(0.12);
  });
  it('NF-e real SIM Fitness→UTF Catete (RJ), item 1: DIFAL+FCP = R$ 2.797,20 sobre base c/ IPI', async () => {
    const { difal } = await import('./icmsUf');
    // vBC 15.540 = vProd 13.752,21 + IPI 1.787,79; vICMSUFDest 2.486,40 + vFCPUFDest 310,80
    expect(difal(15_540, 'RJ', 0.04)).toBeCloseTo(2_486.4 + 310.8, 2);
  });
  it('item lista CAMEX encarece a encomenda (sai dos 4%, sem incentivo)', () => {
    const camex = { ...REF, itens: REF.itens.map((i) => ({ ...i, semSimilarCamex: true })) };
    const normal = cen('SP').encomenda;
    const lista = cen('SP', DEFAULT_TRADING, camex).encomenda;
    expect(lista.custoTotal).toBeGreaterThan(normal.custoTotal);
    // direta não muda: ICMS-importação usa a interna da academia de qualquer jeito
    expect(cen('SP', DEFAULT_TRADING, camex).direta.custoTotal).toBe(cen('SP').direta.custoTotal);
  });
});
