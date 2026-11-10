import { describe, expect, it } from 'vitest';
import { linhaDoTempo4pl, DEFAULT_OPCOES_4PL } from './comex4pl';
import { SIMULACAO_REFERENCIA as REF } from './importCost';
import { projectScenario } from './scenarioDrivers';
import { DEFAULT_SCENARIO_DRIVERS } from './scenarioDrivers';
import { defaultParams } from './params';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

describe('linha do tempo 4PL', () => {
  const lt = linhaDoTempo4pl(REF, 'RJ', 'es-invest', { ...DEFAULT_OPCOES_4PL, margemMinimaTroca: 0 });
  const ano = (a: number) => lt.find((x) => x.ano === a)!;

  it('8 anos, 2033 sempre direta (benefícios extintos)', () => {
    expect(lt).toHaveLength(8);
    expect(ano(2033).modalidade).toBe('direta');
    expect(ano(2033).custoEncomenda).toBeNull();
  });
  it('2027 (IPI zero): encomenda vence para academia no RJ', () => {
    expect(ano(2027).modalidade).toBe('encomenda');
    expect(ano(2027).economia).toBeGreaterThan(0);
  });
  it('Radar Expressa estourado força encomenda', () => {
    const r = linhaDoTempo4pl(REF, 'SP', 'sc-ttd', { ...DEFAULT_OPCOES_4PL, processosSemestre: 2 });
    expect(r.find((x) => x.ano === 2026)!.modalidade).toBe('encomenda');
    expect(r.find((x) => x.ano === 2026)!.motivo).toMatch(/Radar/);
  });
  it('academia na UF do programa: sempre direta', () => {
    const r = linhaDoTempo4pl(REF, 'SC', 'sc-ttd');
    expect(r.every((x) => x.modalidade === 'direta')).toBe(true);
  });
});

describe('receita 4PL no DRE', () => {
  const dre = (ativo: boolean) =>
    projectScenario(INITIAL_GRANULAR_DRE_ITEMS, DEFAULT_SCENARIO_DRIVERS, {
      ...defaultParams,
      comex4pl: { ...defaultParams.comex4pl, ativo },
    });
  it('desligado por padrão: DRE inalterado', () => {
    expect(defaultParams.comex4pl.ativo).toBe(false);
  });
  it('ligado: soma processos × honorário a partir do mês de início e passa pelo DAS', () => {
    const off = dre(false), on = dre(true);
    const c = defaultParams.comex4pl;
    expect(on[c.inicioMes - 2].receitaServicos).toBe(off[c.inicioMes - 2].receitaServicos);
    expect(on[23].receitaServicos - off[23].receitaServicos).toBe(c.processosMesY2 * c.honorarioPorProcesso);
    expect(on[23].das6Percent).toBeGreaterThan(off[23].das6Percent);
  });
});

describe('4PL × Fator R', () => {
  it('folha do 4PL (35% × 80% = 28% da receita) segura o Fator R no Anexo III', () => {
    const on = projectScenario(INITIAL_GRANULAR_DRE_ITEMS, DEFAULT_SCENARIO_DRIVERS, {
      ...defaultParams,
      comex4pl: { ...defaultParams.comex4pl, ativo: true },
    });
    expect(on[23].simples?.anexo).toBe('III');
  });
});
