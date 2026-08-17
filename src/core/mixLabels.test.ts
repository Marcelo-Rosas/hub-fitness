import { describe, it, expect } from 'vitest';
import {
  mixProfileLabel,
  mixProfileKind,
  parse4plCt,
  format4plCell,
  parseBrNumber,
} from './mixLabels';

describe('mixLabels', () => {
  it('maps snake_case perfil to human label', () => {
    expect(mixProfileLabel('P1_Estocador')).toBe('P1 Estocador');
    expect(mixProfileLabel('P4_B2B_Academias')).toBe('P4 B2B Academias');
    expect(mixProfileLabel('Blend_alvo_20_30_25_25')).toBe('Blend Alvo 20/30/25/25');
    expect(mixProfileLabel('Monocliente_P5')).toBe('P5 Premium');
    expect(mixProfileLabel('Cenario_BASE_M12_realista')).toBe('Base M12');
    expect(mixProfileLabel('Cenario_BASE_M24_realista')).toBe('Base M24');
  });

  it('classifies kind', () => {
    expect(mixProfileKind('P2_Franquias')).toBe('perfil');
    expect(mixProfileKind('Blend_conservador_25_30_30_15')).toBe('blend');
    expect(mixProfileKind('Monocliente_P1')).toBe('vetado');
    expect(mixProfileKind('Cenario_BASE_M12_realista')).toBe('marco');
  });

  it('parses 4PL ramp and simple monthly', () => {
    expect(parse4plCt('6000_M12_12000_M24', 'Blend_alvo_20_30_25_25')).toEqual({
      m12: 6000,
      m24: 12000,
    });
    expect(parse4plCt('2000', 'P2_Franquias')).toEqual({ m12: 2000, m24: 2000 });
    expect(parse4plCt('0', 'P1_Estocador')).toEqual({ m12: null, m24: null });
    expect(parse4plCt('6000', 'Cenario_BASE_M12_realista')).toEqual({
      m12: 6000,
      m24: null,
    });
    expect(parse4plCt('12000', 'Cenario_BASE_M24_realista')).toEqual({
      m12: null,
      m24: 12000,
    });
  });

  it('formats 4PL cell without proxy string', () => {
    expect(format4plCell(6000)).toBe('R$ 6.000');
    expect(format4plCell(null)).toBe('—');
    expect(format4plCell(6000)).not.toMatch(/_M12_/);
  });

  it('parses BR number', () => {
    expect(parseBrNumber('52,5')).toBe(52.5);
    expect(parseBrNumber('74,15')).toBe(74.15);
  });
});
