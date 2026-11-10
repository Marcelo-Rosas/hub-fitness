/**
 * Linha do tempo 4PL — escolha da modalidade por ano (2026–2033) para uma academia.
 *
 * O Hub vende SÓ serviço em ambas as modalidades (gestão porta a porta + operação logística):
 *  - 'direta'    academia importa com Radar próprio; Hub = gestão.
 *  - 'encomenda' trading parceira na UF incentivada importa e revende; Hub = gestão + operador
 *                logístico no porto (TTD-SC exige desembaraço em SC → Itajaí). Não usa o Radar.
 * Custo da academia comparado com o MESMO honorário do Hub nos dois casos (+ fee da trading
 * na encomenda). Radar: se o CIF semestral não cabe, encomenda é forçada.
 *
 * Resultado de referência (US$ 40 mil FOB, 9506.91.00, fee trading 2% VA, margem mín. 1%):
 * 2026 direta (IPI 13% na revenda anula o 4%); 2027–2028 encomenda em UFs de ICMS alto
 * (RJ/MA via SC: −R$ 5,6–7,1 mil; via ES inclusive SP); 2029+ direta (ICMS/benefício em
 * redução); 2033 benefícios extintos. Radar estourado força encomenda em qualquer ano.
 */
import { aliqInterna, programaPorId, type UF } from './icmsUf';
import { computeImportacao, RADAR_LIMITE_SEMESTRE_USD, type ImportacaoInput } from './importCost';
import { compararCenarios, DEFAULT_TRADING, type TradingParams } from './importTrading';

export const ANOS_4PL = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033] as const;

export interface Ano4pl {
  ano: number;
  modalidade: 'direta' | 'encomenda';
  custoDireta: number;
  /** null em 2033+ (incentivos de ICMS extintos) ou programa na UF da academia. */
  custoEncomenda: number | null;
  /** Economia da academia na modalidade escolhida vs a outra (≥ 0). */
  economia: number;
  motivo: string;
}

export interface Opcoes4pl {
  /** Processos da academia por semestre (para checar o Radar). */
  processosSemestre: number;
  /** Margem mínima (fração do custo) para trocar para encomenda — cobre risco/complexidade. */
  margemMinimaTroca: number;
  trading?: TradingParams;
}

export const DEFAULT_OPCOES_4PL: Opcoes4pl = { processosSemestre: 1, margemMinimaTroca: 0.01 };

export function linhaDoTempo4pl(
  input: ImportacaoInput,
  ufAcademia: UF,
  progId: string,
  o: Opcoes4pl = DEFAULT_OPCOES_4PL,
): Ano4pl[] {
  const prog = programaPorId(progId);
  const t = o.trading ?? DEFAULT_TRADING;
  return ANOS_4PL.map((ano) => {
    // ICMS-importação da direta = alíquota interna (+FCP) da UF da academia.
    const inp = { ...input, ano, icmsAliquota: aliqInterna(ufAcademia) };
    const direta = computeImportacao(inp);
    const custoDireta = direta.custoTotal;
    const cifSemestre = direta.cifUsd * o.processosSemestre;
    const radarEstoura = cifSemestre > RADAR_LIMITE_SEMESTRE_USD[input.radar];

    if (!prog || prog.uf === ufAcademia || ano >= 2033) {
      return {
        ano,
        modalidade: 'direta' as const,
        custoDireta,
        custoEncomenda: null,
        economia: 0,
        motivo: ano >= 2033
          ? 'ICMS e benefícios extintos (EC 132): sem vantagem de trading'
          : 'Academia na UF do programa: sem operação interestadual',
      };
    }
    const enc = compararCenarios(inp, ufAcademia, prog, t).find((c) => c.cenario === 'encomenda')!;
    const custoEncomenda = Math.round((enc.custoTotal + direta.honorarioHub) * 100) / 100;
    const ganho = custoDireta - custoEncomenda;

    if (radarEstoura) {
      return {
        ano, modalidade: 'encomenda' as const, custoDireta, custoEncomenda, economia: Math.max(0, ganho),
        motivo: `Radar ${input.radar} não comporta ${o.processosSemestre} processo(s)/semestre`,
      };
    }
    if (ganho > custoDireta * o.margemMinimaTroca) {
      return {
        ano, modalidade: 'encomenda' as const, custoDireta, custoEncomenda, economia: ganho,
        motivo: `Encomenda via ${prog.nome} ${((ganho / custoDireta) * 100).toFixed(1)}% mais barata`,
      };
    }
    return {
      ano, modalidade: 'direta' as const, custoDireta, custoEncomenda, economia: Math.max(0, -ganho),
      motivo: ganho > 0 ? 'Ganho da encomenda abaixo da margem mínima' : 'Direta mais barata',
    };
  });
}
