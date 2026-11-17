import { describe, expect, it } from 'vitest';
import {
  buildRequiredDocuments,
  parseCountryIso2,
  summarizeTa,
  ttceForNcm,
  SIMULADOR_RECEITA_URL,
} from '../core/comex/comexTreatments';

// Resposta real do simular-TA (9506.91.00, China), resumida
const TA = [
  {
    numeroTa: 'I1125', tipoTratamento: 'Alerta', orgao: 'ANVISA', modelos: null,
    mensagem: 'Operação sujeita a monitoramento da Agência Nacional de Vigilância sanitária - Anvisa, RDC 977/2025.',
    impedeDesembaraco: null, efeitos: [{ descricao: 'Exibe mensagem', condicoes: null }],
  },
  {
    numeroTa: 'I0927', tipoTratamento: 'Requer LPCO', orgao: 'INMETRO',
    modelos: [
      { codigo: 'I00014', nome: 'Produtos sujeitos a registro de objeto', preenchimento: 'Ambos' },
      { codigo: 'I00207', nome: 'Produtos sujeitos a registro de objeto com Conjunto', preenchimento: 'Pelo exportador/importador' },
    ],
    mensagem: null, impedeDesembaraco: true,
    efeitos: [{ descricao: 'Requer LPCO', condicoes: [{ descricaoCondicao: 'Destinação', valores: [{ id: '1', descricao: 'Comercialização' }] }] }],
  },
];

describe('summarizeTa', () => {
  it('resume órgão, tipo, modelos, impedimento e condições', () => {
    const s = summarizeTa(TA);
    expect(s.exigeLpco).toBe(true);
    expect(s.impedeDesembaraco).toBe(true);
    expect(s.orgaos).toEqual(['ANVISA', 'INMETRO']);
    const inmetro = s.itens.find((i) => i.orgao === 'INMETRO')!;
    expect(inmetro.modelos.map((m) => m.codigo)).toEqual(['I00014', 'I00207']);
    expect(inmetro.condicoes).toEqual(['Destinação: Comercialização']);
    expect(s.itens.find((i) => i.orgao === 'ANVISA')?.mensagem).toMatch(/RDC 977\/2025/);
  });

  it('lista vazia ou inválida = sem tratamento', () => {
    expect(summarizeTa([]).itens).toEqual([]);
    expect(summarizeTa(null).exigeLpco).toBe(false);
  });
});

describe('buildRequiredDocuments', () => {
  const ta = summarizeTa(TA);
  it('Radar Limitado → DI; demais → DUIMP; LPCO entra quando exigido', () => {
    const lim = buildRequiredDocuments({ radarModality: 'limitada_50k', ta });
    expect(lim).toContain('DI (Radar Limitado — DUIMP indisponível)');
    expect(lim.some((d) => d.startsWith('LPCO INMETRO'))).toBe(true);
    expect(lim.slice(0, 3)).toEqual(['Invoice comercial', 'Packing list', 'BL / conhecimento de embarque']);
    const ili = buildRequiredDocuments({ radarModality: 'ilimitada', ta: summarizeTa([]) });
    expect(ili).toContain('DUIMP');
    expect(ili.some((d) => d.startsWith('LPCO'))).toBe(false);
  });
  it('sem cliente → DI/DUIMP conforme o Radar do importador', () => {
    expect(buildRequiredDocuments({ radarModality: null, ta: null })).toContain(
      'DI ou DUIMP (conforme o Radar do importador)',
    );
  });
});

describe('ttceForNcm', () => {
  const file = {
    dataFatoGerador: '2026-11-17',
    intervalosNcm: [
      {
        intervaloInicialNcm: '95060000', intervaloFinalNcm: '95069999',
        origensDestinosTratamentos: [
          {
            todosPaisesOrigem: true, paisesOrigem: [],
            destinosTratamentos: [{
              destinos: [{ todasUfsMunicipios: true }],
              tratamentosTributarios: [
                { tributo: { codigo: '1', nome: 'II' }, regime: { codigo: '1', nome: 'Recolhimento Integral' }, fundamentoLegal: { codigo: '9', nome: 'TEC', tipo: 'Normal' } },
                { tributo: { codigo: '1', nome: 'II' }, regime: { codigo: '5', nome: 'Redução' }, fundamentoLegal: { codigo: '1037', nome: 'Ex-tarifário BK', tipo: 'Opcional' }, mercadorias: [{ atributos: [{ codigo: 'ATT_1', descricao: 'Ex' }] }] },
              ],
            }],
          },
          {
            todosPaisesOrigem: false, paisesOrigem: ['063'],
            destinosTratamentos: [{ destinos: [], tratamentosTributarios: [
              { tributo: { codigo: '1', nome: 'II' }, regime: { codigo: '7', nome: 'Acordo' }, fundamentoLegal: { codigo: '777', nome: 'ACE Mercosul', tipo: 'Opcional' } },
            ] }],
          },
        ],
      },
      { intervaloInicialNcm: '01010000', intervaloFinalNcm: '01019999', origensDestinosTratamentos: [] },
    ],
  };
  it('filtra pelo intervalo da NCM e pela origem; separa normais e opcionais (Ex-tarifário em destaque)', () => {
    const r = ttceForNcm(file, '9506.91.00', '160');
    expect(r.normais.map((t) => t.fundamento)).toEqual(['TEC']);
    expect(r.opcionais.map((t) => t.fundamento)).toEqual(['Ex-tarifário BK']);
    expect(r.opcionais[0].exTarifario).toBe(true);
    expect(r.opcionais[0].exigeAtributos).toBe(true);
    expect(r.tributos).toEqual(['II']);
  });
  it('origem com acordo próprio entra só para aquele país', () => {
    expect(ttceForNcm(file, '95069100', '063').opcionais.map((t) => t.fundamento)).toContain('ACE Mercosul');
    expect(ttceForNcm(file, '95069100', '160').opcionais.map((t) => t.fundamento)).not.toContain('ACE Mercosul');
  });
  it('NCM fora dos intervalos → vazio', () => {
    const r = ttceForNcm(file, '84149039', '160');
    expect(r.normais).toEqual([]);
    expect(r.opcionais).toEqual([]);
  });
});

describe('utilidades', () => {
  it('parseCountryIso2 extrai o ISO2 do rótulo da tela', () => {
    expect(parseCountryIso2('China (CN)')).toBe('CN');
    expect(parseCountryIso2('cn')).toBe('CN');
    expect(parseCountryIso2('Brasil')).toBeNull();
  });
  it('link do simulador da Receita', () => {
    expect(SIMULADOR_RECEITA_URL).toBe('https://www4.receita.fazenda.gov.br/simulador/');
  });
});
