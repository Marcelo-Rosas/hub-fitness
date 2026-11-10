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
