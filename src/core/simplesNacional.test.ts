import { describe, expect, it } from 'vitest';
import {
  aliquotaEfetiva,
  ANEXO_III,
  ANEXO_V,
  computeDasMes,
  computeDasSeries,
  faixaIndex,
  ISS_TETO_EFETIVO,
  rbt12Inicio,
} from './simplesNacional';
import { defaultParams } from './params';
import { DEFAULT_SCENARIO_DRIVERS, projectScenario } from './scenarioDrivers';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

describe('tabelas LC 123 (LC 155/2016)', () => {
  it('repartições somam 100% em todas as faixas', () => {
    for (const f of [...ANEXO_III, ...ANEXO_V]) {
      const r = f.reparticao;
      expect(r.irpj + r.csll + r.cofins + r.pis + r.cpp + r.iss).toBeCloseTo(1, 6);
    }
  });

  it('alíquota efetiva é contínua nas fronteiras das faixas 1–5', () => {
    // A 6ª faixa é descontínua na própria lei (ex.: Anexo III cai de 17,51% para 15%
    // em R$ 3,6 mi porque ISS sai do DAS). Não é bug da tabela.
    for (const tabela of [ANEXO_III, ANEXO_V]) {
      for (let i = 0; i < tabela.length - 2; i++) {
        const limite = tabela[i].ate;
        const ate = (limite * tabela[i].nominal - tabela[i].deduzir) / limite;
        const prox = (limite * tabela[i + 1].nominal - tabela[i + 1].deduzir) / limite;
        expect(prox).toBeCloseTo(ate, 4);
      }
    }
  });

  it('6% só vale até R$ 180 mil (1ª faixa Anexo III)', () => {
    expect(aliquotaEfetiva(180_000, 'III')).toBeCloseTo(0.06, 6);
    expect(aliquotaEfetiva(180_001, 'III')).toBeGreaterThan(0.06);
  });

  it('RBT12 R$ 2,57 mi → 5ª faixa Anexo III ≈ 16,11%', () => {
    expect(faixaIndex(2_570_856, 'III')).toBe(4);
    expect(aliquotaEfetiva(2_570_856, 'III')).toBeCloseTo(0.161129, 5);
  });
});

describe('início de atividade (art. 18 §2º)', () => {
  it('M1 = receita × 12; M2..M12 = média anteriores × 12; M13+ = soma 12', () => {
    const r = [100, 200, 300, ...Array(20).fill(400)];
    expect(rbt12Inicio(r, 0)).toBe(1_200);
    expect(rbt12Inicio(r, 1)).toBe(1_200);
    expect(rbt12Inicio(r, 2)).toBe(1_800);
    expect(rbt12Inicio(r, 12)).toBe(100 + 200 + 300 + 400 * 9);
    expect(rbt12Inicio(r, 13)).toBe(200 + 300 + 400 * 10);
  });
});

describe('DAS mensal', () => {
  it('Fator R < 28% → Anexo V; ≥ 28% → Anexo III', () => {
    expect(computeDasMes(100_000, 1_200_000, 0.279).anexo).toBe('V');
    expect(computeDasMes(100_000, 1_200_000, 0.28).anexo).toBe('III');
  });

  it('ISS limitado a 5% efetivo na 5ª faixa; total do DAS preservado', () => {
    const d = computeDasMes(200_000, 2_570_856, 0.3);
    const iss = d.pisCofinsCppIss; // inclui PIS/Cofins/CPP/ISS
    expect(d.das).toBeCloseTo(200_000 * d.aliquotaEfetiva, 6);
    expect(d.irpj + d.csll + iss).toBeCloseTo(d.das, 6);
    // IRPJ sobe acima de 4% do DAS porque recebeu parte do excedente de ISS
    expect(d.irpj / d.das).toBeGreaterThan(0.04);
    expect(ISS_TETO_EFETIVO).toBe(0.05);
  });

  it('6ª faixa (acima do sublimite) sinaliza ISS fora do DAS', () => {
    const d = computeDasMes(350_000, 4_000_000, 0.3);
    expect(d.faixa).toBe(6);
    expect(d.acimaSublimite).toBe(true);
    expect(d.acimaDoTeto).toBe(false);
  });

  it('série anexa folha para Fator R', () => {
    const s = computeDasSeries([100_000, 100_000], [30_000, 30_000]);
    expect(s[0].anexo).toBe('III');
    expect(s[0].fatorR).toBeCloseTo(0.3, 6);
  });
});

describe('DRE ao vivo com seed', () => {
  it('nenhum mês usa 6% fixo; alíquota efetiva > 6% com receita do plano', () => {
    const months = projectScenario(INITIAL_GRANULAR_DRE_ITEMS, DEFAULT_SCENARIO_DRIVERS, defaultParams);
    for (const m of months) {
      expect(m.simples).toBeDefined();
      expect(m.simples!.aliquotaEfetiva).toBeGreaterThan(0.06);
      expect(m.irpj + m.csll + m.pisCofinsCppIss).toBe(m.das6Percent);
    }
  });
});
