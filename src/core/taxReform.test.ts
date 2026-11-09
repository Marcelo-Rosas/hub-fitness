import { describe, expect, it } from 'vitest';
import {
  breakevenClientesCredito,
  computeRegimeAno,
  computeReformaSeries,
  DEFAULT_REFORMA,
  TRANSICAO,
  type BaseAnual,
} from './taxReform';

const BASE: BaseAnual = {
  receita: 2_400_000,
  custos: 800_000,
  despesas: 1_200_000,
  das: 2_400_000 * 0.1577,
  folha: 700_000,
  rbt12: 2_400_000,
  anexo: 'III',
};
const F2027 = TRANSICAO.find((f) => f.ano === 2027)!;
const F2033 = TRANSICAO.find((f) => f.ano === 2033)!;

describe('transição EC 132', () => {
  it('ISS 100% até 2028, 90→60% em 2029–2032, extinto em 2033', () => {
    expect(TRANSICAO.map((f) => f.issFracao)).toEqual([1, 1, 0.9, 0.8, 0.7, 0.6, 0]);
    expect(F2033.ibsFracao).toBe(1);
  });
});

describe('Simples por dentro', () => {
  it('carga = DAS; lucro independe do ano', () => {
    const a = computeRegimeAno('simples', F2027, BASE);
    const b = computeRegimeAno('simples', F2033, BASE);
    expect(a.cargaTotal).toBe(Math.round(BASE.das));
    expect(a.lucroLiquido).toBe(b.lucroLiquido);
  });

  it('crédito ao cliente cresce quando ISS vira IBS dentro do DAS', () => {
    const a = computeRegimeAno('simples', F2027, BASE);
    const b = computeRegimeAno('simples', F2033, BASE);
    expect(b.creditoClientePor100).toBeGreaterThan(a.creditoClientePor100);
  });
});

describe('híbrido', () => {
  it('100% clientes creditantes e 0 insumos: lucro = Simples + (DAS − DAS sem consumo) − crédito Simples perdido', () => {
    const p = { ...DEFAULT_REFORMA, clientesCreditoPct: 1, insumosCreditaveisPct: 0 };
    const s = computeRegimeAno('simples', F2027, BASE, p);
    const h = computeRegimeAno('hibrido', F2027, BASE, p);
    // receita retida = receita − crédito que o cliente tinha no Simples
    expect(h.receitaRetida).toBeLessThan(BASE.receita);
    expect(h.creditoInsumos).toBe(0);
    expect(h.tributosRenda).toBeLessThan(s.tributosRenda);
  });

  it('mais clientes creditantes → lucro maior', () => {
    const lo = computeRegimeAno('hibrido', F2027, BASE, { ...DEFAULT_REFORMA, clientesCreditoPct: 0.2 });
    const hi = computeRegimeAno('hibrido', F2027, BASE, { ...DEFAULT_REFORMA, clientesCreditoPct: 0.9 });
    expect(hi.lucroLiquido).toBeGreaterThan(lo.lucroLiquido);
  });

  it('crédito ao cliente = CBS + IBS vigente', () => {
    const h = computeRegimeAno('hibrido', F2033, BASE);
    expect(h.creditoClientePor100).toBeCloseTo(100 * (DEFAULT_REFORMA.cbsRef + DEFAULT_REFORMA.ibsRef), 2);
  });

  it('breakeven de clientes creditantes está entre 0 e 1 e é ponto de empate', () => {
    const be = breakevenClientesCredito(BASE, 2027)!;
    expect(be).toBeGreaterThan(0);
    expect(be).toBeLessThan(1);
    const s = computeRegimeAno('simples', F2027, BASE);
    const h = computeRegimeAno('hibrido', F2027, BASE, { ...DEFAULT_REFORMA, clientesCreditoPct: be });
    expect(Math.abs(h.lucroLiquido - s.lucroLiquido)).toBeLessThanOrEqual(2);
  });
});

describe('série', () => {
  it('7 anos × 3 regimes', () => {
    const s = computeReformaSeries(BASE);
    expect(s).toHaveLength(7);
    expect(s[0].presumido.regime).toBe('presumido');
  });
});
