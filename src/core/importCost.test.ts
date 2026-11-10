import { describe, expect, it } from 'vitest';
import {
  computeImportacao,
  computeImportacaoReforma,
  SIMULACAO_REFERENCIA as REF,
  taxaSiscomex,
  type ImportacaoInput,
} from './importCost';

/** Reproduz a aba CONVENCIONAL: seguro a 5,91 (taxa armador) e ICMS 22% (RJ). */
const PLANILHA: ImportacaoInput = {
  ...REF,
  seguroUsd: (109 * 5.91) / 5.18,
  icmsAliquota: 0.22,
};

describe('âncora planilha real (CONVENCIONAL)', () => {
  const r = computeImportacao(PLANILHA);
  it('FOB R$ 208.779,90 e valor aduaneiro R$ 235.323,57', () => {
    expect(r.fobBrl).toBeCloseTo(208_779.9, 1);
    expect(r.valorAduaneiro).toBeCloseTo(235_323.57, -1); // ±R$ 5: planilha arredonda seguro
  });
  it('II / IPI / PIS / COFINS batem com a planilha', () => {
    expect(r.ii).toBeCloseTo(42_358, -1);
    expect(r.ipi).toBeCloseTo(36_099, -1);
    expect(r.pis).toBeCloseTo(4_942, -1);
    expect(r.cofins).toBeCloseTo(24_591, -1);
  });
  it('ICMS por dentro ≈ R$ 97,6 mil (diferença só do AFRMM corrigido)', () => {
    // Planilha: 97.579 com AFRMM 2.495 (base em taxa armador + EXW). Aqui AFRMM = 8% frete × PTAX.
    expect(r.afrmm).toBeCloseTo(4_500 * 5.18 * 0.08, 2);
    expect(Math.abs(r.icms - 97_579) / 97_579).toBeLessThan(0.005);
  });
  it('Siscomex 1 adição = R$ 154,23', () => {
    expect(r.siscomex).toBe(154.23);
  });
});

describe('Siscomex por faixa', () => {
  it('3 adições = 115,67 + 2×38,56 + 30,85', () => {
    expect(taxaSiscomex(3)).toBeCloseTo(115.67 + 2 * 38.56 + 30.85, 2);
  });
});

describe('Radar', () => {
  it('Expressa: CIF ~US$ 45,4 mil cabe; segundo processo no semestre estoura', () => {
    const a = computeImportacao(REF);
    expect(a.cifUsd).toBeCloseTo(45_414, 0);
    expect(a.radar.excede).toBe(false);
    const b = computeImportacao({ ...REF, cifSemestreAnteriorUsd: a.cifUsd });
    expect(b.radar.excede).toBe(true);
  });
  it('Limitada US$ 150 mil comporta 3 processos/semestre', () => {
    const b = computeImportacao({ ...REF, radar: 'limitada', cifSemestreAnteriorUsd: 2 * 45_414 });
    expect(b.radar.excede).toBe(false);
  });
});

describe('Hub = só serviço', () => {
  it('receita do Hub = honorário (nunca valor da mercadoria)', () => {
    const r = computeImportacao(REF);
    expect(r.receitaHub).toBe(25_000);
    const pct = computeImportacao({ ...REF, honorarioHub: { tipo: 'pctFob', pct: 0.1 } });
    expect(pct.receitaHub).toBeCloseTo(20_877.99, 1);
  });
});

describe('Reforma na importação', () => {
  const serie = computeImportacaoReforma(REF);
  const ano = (a: number) => serie.find((s) => s.ano === a)!.r;
  it('2026: PIS/COFINS; 2027+: CBS e IBS no lugar, IPI zerado (hipótese)', () => {
    expect(ano(2026).pis).toBeGreaterThan(0);
    expect(ano(2026).cbs).toBe(0);
    expect(ano(2027).pis).toBe(0);
    expect(ano(2027).cofins).toBe(0);
    expect(ano(2027).cbs).toBeGreaterThan(0);
    expect(ano(2027).ipi).toBe(0);
  });
  it('ICMS cai na transição e some em 2033; IBS assume', () => {
    expect(ano(2030).icms).toBeLessThan(ano(2028).icms);
    expect(ano(2033).icms).toBe(0);
    expect(ano(2033).ibs).toBeGreaterThan(ano(2032).ibs);
  });
  it('sem zerar IPI, 2027 custa mais que com IPI zerado', () => {
    const com = computeImportacao({ ...REF, ano: 2027, ipiZeraNaReforma: false });
    expect(com.custoTotal).toBeGreaterThan(ano(2027).custoTotal);
  });
});

describe('cobranças do agente em USD (planilha B316)', () => {
  it('US$ 1.700 × PTAX × 1,14 = R$ 10.038,84, fora do VA e do CIF', () => {
    const com = computeImportacao(REF);
    const sem = computeImportacao({ ...REF, despesasAgenteUsd: 0 });
    expect(com.despesasAgenteBrl).toBeCloseTo(10_038.84, 2);
    expect(com.valorAduaneiro).toBe(sem.valorAduaneiro);
    expect(com.cifUsd).toBe(sem.cifUsd);
    expect(com.icms).toBe(sem.icms);
    expect(com.custoTotal - sem.custoTotal).toBeCloseTo(10_038.84, 1);
  });
  it('sem spread usa PTAX pura', () => {
    const r = computeImportacao({ ...REF, cambioAgenteSpread: 0 });
    expect(r.despesasAgenteBrl).toBeCloseTo(1_700 * 5.18, 2);
  });
});
