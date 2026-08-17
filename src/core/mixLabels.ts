export type MixRowKind = 'perfil' | 'blend' | 'vetado' | 'marco';

const LABELS: Record<string, string> = {
  P1_Estocador: 'P1 Estocador',
  P2_Franquias: 'P2 Franquias',
  P4_B2B_Academias: 'P4 B2B Academias',
  P5_Premium: 'P5 Premium',
  Blend_alvo_20_30_25_25: 'Blend Alvo 20/30/25/25',
  Blend_conservador_25_30_30_15: 'Blend Conservador 25/30/30/15',
  Blend_agressivo_10_30_20_40: 'Blend Agressivo 10/30/20/40',
  Monocliente_P5: 'P5 Premium',
  Monocliente_P1: 'P1 Estocador',
  Monocliente_P4: 'P4 B2B Academias',
  Cenario_BASE_M12_realista: 'Base M12',
  Cenario_BASE_M24_realista: 'Base M24',
};

export function mixProfileLabel(perfil: string): string {
  return LABELS[perfil] ?? perfil.replace(/_/g, ' ');
}

export function mixProfileKind(perfil: string): MixRowKind {
  const p = perfil.toLowerCase();
  if (p.includes('monocliente')) return 'vetado';
  if (p.includes('blend')) return 'blend';
  if (p.includes('cenario_base') || p.startsWith('cenario_')) return 'marco';
  return 'perfil';
}

export function parseBrNumber(raw: string): number {
  if (raw === '—' || raw === '-') return Number.NaN;
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

const RAMP = /^(\d+)_M12_(\d+)_M24$/;

export function parse4plCt(
  raw: string,
  perfil: string,
): { m12: number | null; m24: number | null } {
  const kind = mixProfileKind(perfil);
  const ramp = raw.match(RAMP);
  if (ramp) {
    return { m12: Number(ramp[1]), m24: Number(ramp[2]) };
  }
  const n = Number(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n === 0) return { m12: null, m24: null };
  if (kind === 'marco' && perfil.includes('M12')) return { m12: n, m24: null };
  if (kind === 'marco' && perfil.includes('M24')) return { m12: null, m24: n };
  return { m12: n, m24: n };
}

export function format4plCell(n: number | null): string {
  if (n == null) return '—';
  return `R$ ${n.toLocaleString('pt-BR')}`;
}
