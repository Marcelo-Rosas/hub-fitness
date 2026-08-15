/**
 * BP v3.5 reference fixture — seed + regression only, never runtime bypass.
 * Source: 01_DRE_24_meses.csv, 02_Fluxo_Caixa.csv, BP_3PL_Fitness_v3.5.md
 */
export {
  OFFICIAL_DRE_MONTHS,
  OFFICIAL_CASHFLOW_SERIES,
  OFFICIAL_TOTALS_24M,
  SANCO_VAS_FLOORS,
  parseOfficialCSVs,
  type OfficialDreMonth,
  type OfficialCashMonth,
  type SancoVasFloor,
} from '../data/officialData';
