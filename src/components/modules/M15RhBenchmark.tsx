import React from 'react';
import {
  Users,
  Building2,
  ShieldAlert,
  Award,
  FileCheck,
  Briefcase,
  BookOpen,
} from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { formatDasPct, formatFatorRBand, plPhaseBands } from '../../core/governanceMatrix';
import { plAdditionalForMonth } from '../../core/engine';

type ChargeCell = number | null | 'isento';

interface RoleRow {
  cargo: string;
  detail: string;
  cc: string;
  ccTone: 'slate' | 'blue' | 'amber';
  salarioBase: number | null;
  periculosidade: ChargeCell;
  fgts: ChargeCell;
  decimo: ChargeCell;
  ferias: ChargeCell;
  totalEncargos: ChargeCell;
  custoHc: number;
  phases: { hc: string; cost: number }[];
  highlight?: boolean;
  perilNote?: string;
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtCell = (v: ChargeCell) => {
  if (v === null) return '—';
  if (v === 'isento') return 'Isento CLT';
  return `R$ ${fmt(v)}`;
};

const ROLES: RoleRow[] = [
  {
    cargo: 'Coordenador Logístico / Supervisor WMS',
    detail: 'Gestão operacional, inventários e interface 4PL',
    cc: 'CC 001',
    ccTone: 'slate',
    salarioBase: 5200,
    periculosidade: null,
    fgts: 416,
    decimo: 433,
    ferias: 578,
    totalEncargos: 1427,
    custoHc: 6627,
    phases: [
      { hc: '1 HC', cost: 6627 },
      { hc: '1 HC', cost: 6627 },
      { hc: '1 HC', cost: 6627 },
      { hc: '1 HC', cost: 6627 },
    ],
  },
  {
    cargo: 'Assistente Admin / SAC / Faturamento NF-e',
    detail: 'Emissão de conhecimentos, agendamento e atendimento B2B/B2C',
    cc: 'CC 001',
    ccTone: 'slate',
    salarioBase: 2800,
    periculosidade: null,
    fgts: 224,
    decimo: 233,
    ferias: 311,
    totalEncargos: 768,
    custoHc: 3568,
    phases: [
      { hc: '0 HC', cost: 0 },
      { hc: '1 HC', cost: 3568 },
      { hc: '2 HC', cost: 7136 },
      { hc: '2 HC', cost: 7136 },
    ],
  },
  {
    cargo: 'Operador de Empilhadeira Retrátil KONNEN (>500 kg)',
    detail: 'Operação em altura (8,5 m) · NR-16 · Conta 5.2.01.09',
    cc: 'CC 002',
    ccTone: 'blue',
    salarioBase: 3200,
    periculosidade: 960,
    fgts: 333,
    decimo: 347,
    ferias: 462,
    totalEncargos: 1142,
    custoHc: 5302,
    perilNote: 'FGTS/13º/Férias sobre base + adicional (R$ 4.160)',
    phases: [
      { hc: '1 HC', cost: 5302 },
      { hc: '1,4 HC', cost: 7423 },
      { hc: '2 HC', cost: 10604 },
      { hc: '2 HC', cost: 10604 },
    ],
  },
  {
    cargo: 'Conferente / Auxiliar de Armazém / Etiquetagem',
    detail: 'Recebimento, picking fracionado e kitting e-commerce',
    cc: 'CC 002',
    ccTone: 'blue',
    salarioBase: 2200,
    periculosidade: null,
    fgts: 176,
    decimo: 183,
    ferias: 244,
    totalEncargos: 603,
    custoHc: 2803,
    phases: [
      { hc: '1 HC', cost: 2803 },
      { hc: '2 HC', cost: 5606 },
      { hc: '3 HC', cost: 8409 },
      { hc: '3 HC', cost: 8409 },
    ],
  },
  {
    cargo: 'Pró-Labore Sócios Executivos (Base Regular)',
    detail: 'Diretoria de Operações e Direção Comercial / CFO',
    cc: 'CC 005',
    ccTone: 'amber',
    salarioBase: 5500,
    periculosidade: 'isento',
    fgts: null,
    decimo: null,
    ferias: null,
    totalEncargos: null,
    custoHc: 5500,
    highlight: true,
    phases: [
      { hc: '2 Sócios', cost: 11000 },
      { hc: '2 Sócios', cost: 13500 },
      { hc: '2 Sócios', cost: 18500 },
      { hc: '2 Sócios', cost: 19000 },
    ],
  },
];

const PHASE_TOTALS = [
  { hc: '5,0 HC', cost: 25732 },
  { hc: '7,4 HC', cost: 36724 },
  { hc: '10,0 HC', cost: 51276 },
  { hc: '10,0 HC', cost: 51776 },
];

const ccBadge = (tone: RoleRow['ccTone']) => {
  if (tone === 'blue') return 'bg-blue-100 text-blue-800';
  if (tone === 'amber') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

export const M15RhBenchmark: React.FC = () => {
  const { hubParams } = usePlanner();
  const band = formatFatorRBand(hubParams);
  const dasLabel = formatDasPct(hubParams);
  const plBands = plPhaseBands(hubParams);
  const plM4 = plAdditionalForMonth(hubParams, 4);
  const plM12 = plAdditionalForMonth(hubParams, 12);
  const plM13 = plAdditionalForMonth(hubParams, 13);
  const plBase = hubParams.fiscal.plBaseMonthly;
  const capacity = hubParams.capacity.totalPositions;

  return (
    <div className="space-[#1F3864] space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-[#1F3864] text-white p-6 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-linear-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider mb-1">
              <Users className="w-4 h-4" />
              <span>Módulo M15 · Recursos Humanos & Governança Salarial</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Estrutura Organizacional & Benchmark Salarial SC
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Dimensionamento de headcount (CLT e Pró-labore), encargos granularizados por percentual e
              evidência do adicional de Periculosidade NR-16 (CC 002).
            </p>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-xs border border-emerald-500/30 px-4 py-2.5 rounded-lg text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-extrabold block">
              ● Status da Governança
            </span>
            <span className="text-sm font-mono font-bold text-white">Ancorado no BP v3.6</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Encargos auditáveis · Conta 5.2.01.09
            </span>
          </div>
        </div>
      </div>

      {/* PHASE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Fase 1 · Startup / Âncora
              </span>
              <span className="text-xs text-blue-700 font-bold block mt-0.5">Mês 1 ao Mês 3</span>
            </div>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-mono font-bold rounded">
              5 HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-slate-900">
              R$ 25.732 <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Equipe mínima essencial: 1 Supervisor, 2 Operadores/Conferentes e 2 Sócios.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Fase 2 · Ramp-up
              </span>
              <span className="text-xs text-amber-700 font-bold block mt-0.5">Mês 4 ao Mês 6</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-mono font-bold rounded">
              7,4 HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-slate-900">
              R$ 36.724 <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Início do SAC/Admin, 2º turno de empilhadeira e reforço de conferência.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Fase 3 · Operação Plena Y1
              </span>
              <span className="text-xs text-emerald-700 font-bold block mt-0.5">Mês 7 ao Mês 12</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold rounded">
              10 HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-emerald-800">
              R$ 51.276 <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Capacidade máxima de {capacity.toLocaleString('pt-BR')} posições ativas. 8 operacionais + 2 Pró-labore.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Fase 4 · Estabilização Y2
              </span>
              <span className="text-xs text-indigo-700 font-bold block mt-0.5">Mês 13 ao Mês 24</span>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 text-[10px] font-mono font-bold rounded">
              10 HC
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black font-mono text-indigo-900">
              R$ 51.776 <span className="text-xs font-normal text-slate-500">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              PL fase ajustado; reajustes CLT passam a linha própria na v3.6 (não embutidos).
            </p>
          </div>
        </div>
      </div>

      {/* HIGHLIGHT CARD: GOVERNANÇA DO FATOR R */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-amber-950 uppercase tracking-wide">
                Governança Fator R: Pró-Labore Adicional Discricionário (Conta 5.2.01.03)
              </h3>
              <span className="px-2.5 py-1 bg-amber-200 text-amber-900 text-xs font-mono font-bold rounded-full w-fit">
                Banda Alvo Safe: {band}
              </span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Além dos salários e pró-labore base (Conta 5.2.01.01), a estrutura conta com o{' '}
              <strong>Pró-Labore Adicional Discricionário</strong>. Evidenciar a Periculosidade (5.2.01.09)
              aumenta o numerador do Fator R e dá folga para reduzir o PL adicional.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">M1 a M3</span>
                <span className="text-sm font-black font-mono text-slate-900">+R$ 0 /mês</span>
                <span className="text-[10px] text-slate-500 block">
                  PL base R$ {plBase.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">
                  M{plBands[0]?.fromMonth ?? 4}+
                </span>
                <span className="text-sm font-black font-mono text-slate-900">
                  +R$ {plM4.toLocaleString('pt-BR')}/mês
                </span>
                <span className="text-[10px] text-slate-500 block">
                  (Total PL: R$ {(plBase + plM4).toLocaleString('pt-BR')})
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">
                  M{plBands[1]?.fromMonth ?? 12} (Ajuste)
                </span>
                <span className="text-sm font-black font-mono text-slate-900">
                  +R$ {plM12.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-slate-500 block">One-shot Balanço 12m</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">
                  M{plBands[2]?.fromMonth ?? 13}+
                </span>
                <span className="text-sm font-black font-mono text-slate-900">
                  +R$ {plM13.toLocaleString('pt-BR')}/mês
                </span>
                <span className="text-[10px] text-slate-500 block">
                  (Total PL: R$ {(plBase + plM13).toLocaleString('pt-BR')})
                </span>
              </div>
            </div>

            <div className="text-[11px] text-amber-950 font-medium bg-amber-100/80 p-2.5 rounded border border-amber-300 mt-2">
              💡 <strong>Blindagem Fiscal:</strong> Ao injetar esse adicional, a alíquota efetiva do DAS
              permanece em <strong>{dasLabel} (Anexo III)</strong> enquanto o Fator R fica na banda {band}.
            </div>
          </div>
        </div>
      </div>

      {/* GAP CONTÁBIL: PERICULOSIDADE */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h3 className="text-sm font-extrabold text-blue-950 uppercase tracking-wide">
              Conta Contábil · Adicional de Periculosidade
            </h3>
            <p className="text-xs text-blue-900 leading-relaxed">
              Na matriz v3.5 o adicional de 30% (NR-16) ficava diluído em “Encargos Diretos” do CC 002,
              sem coluna, percentual ou conta própria. Na v3.6 cria-se a analítica:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="bg-white border border-blue-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-blue-800 block">5.2.01.09</span>
                Adicional de Periculosidade (NR-16) · CC 002
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-slate-700 block">5.2.01.01</span>
                Salários e Ordenados
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-slate-700 block">5.2.01.06 / .05 / .04</span>
                FGTS · 13º · Férias + 1/3
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-2.5">
                <span className="font-mono font-bold text-amber-800 block">Rubrica 0311</span>
                Periculosidade 30% · base = salário base
              </div>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Impacto evidenciado ≈ R$ 1.223/HC/mês (R$ 960 + R$ 263 de reflexos). Com 2 HC a partir de M7
              ≈ +R$ 2.446/mês. Em 24 meses o delta líquido fica &lt; R$ 15k (&lt;0,3% da receita) — imaterial
              para a margem de 11,9%, e melhora o Fator R.
            </p>
          </div>
        </div>
      </div>

      {/* DETAILED HEADCOUNT & SALARY TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#1F3864]" />
              <span>Matriz Detalhada de Cargos, Salários e Headcount por Fase</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Encargos separados por coluna (título + %). INSS patronal diluído no DAS 6% (não entra nesta
              matriz). Total encargos CLT = 27,44% sobre a base de cálculo.
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded shrink-0">
            Região: Itajaí & Navegantes / SC
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse min-w-275">
            <thead>
              <tr className="bg-[#1F3864] text-white font-bold">
                <th className="py-2.5 px-3 sticky left-0 bg-[#1F3864] z-10 min-w-50">
                  Cargo / Função
                </th>
                <th className="py-2.5 px-2 text-center">CC</th>
                <th className="py-2.5 px-2 text-right">
                  Salário Base
                  <span className="block text-[9px] font-normal text-white/70">R$ / HC</span>
                </th>
                <th className="py-2.5 px-2 text-right bg-orange-900/50">
                  Periculosidade
                  <span className="block text-[9px] font-normal text-orange-100">NR-16 · 30%</span>
                </th>
                <th className="py-2.5 px-2 text-right">
                  FGTS
                  <span className="block text-[9px] font-normal text-white/70">8%</span>
                </th>
                <th className="py-2.5 px-2 text-right">
                  13º Salário
                  <span className="block text-[9px] font-normal text-white/70">8,33%</span>
                </th>
                <th className="py-2.5 px-2 text-right">
                  Férias + 1/3
                  <span className="block text-[9px] font-normal text-white/70">11,11%</span>
                </th>
                <th className="py-2.5 px-2 text-right bg-slate-800/40">
                  Total Encargos
                  <span className="block text-[9px] font-normal text-white/70">27,44%</span>
                </th>
                <th className="py-2.5 px-2 text-right bg-emerald-900/40">
                  Custo / HC
                  <span className="block text-[9px] font-normal text-emerald-100">Base + Enc.</span>
                </th>
                <th className="py-2.5 px-2 text-center bg-blue-900/60">Fase 1<br /><span className="text-[9px] font-normal">M1–3</span></th>
                <th className="py-2.5 px-2 text-center bg-amber-900/60">Fase 2<br /><span className="text-[9px] font-normal">M4–6</span></th>
                <th className="py-2.5 px-2 text-center bg-emerald-900/60">Fase 3<br /><span className="text-[9px] font-normal">M7–12</span></th>
                <th className="py-2.5 px-2 text-center bg-indigo-900/60">Fase 4<br /><span className="text-[9px] font-normal">M13–24</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ROLES.map((row) => (
                <tr
                  key={row.cargo}
                  className={`hover:bg-slate-50 ${row.highlight ? 'bg-amber-50/30' : ''}`}
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900 sticky left-0 bg-white z-1">
                    {row.cargo}
                    <span className="block text-[10px] font-normal text-slate-500">{row.detail}</span>
                    {row.perilNote && (
                      <span className="block text-[9px] font-medium text-orange-700 mt-0.5">
                        {row.perilNote}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`px-1.5 py-0.5 font-mono text-[10px] rounded font-bold ${ccBadge(row.ccTone)}`}
                    >
                      {row.cc}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    {row.salarioBase != null ? `R$ ${fmt(row.salarioBase)}` : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono bg-orange-50/60">
                    {row.periculosidade === 960 ? (
                      <span className="font-bold text-orange-800">30% · R$ 960</span>
                    ) : (
                      <span className="text-slate-500">{fmtCell(row.periculosidade)}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    {fmtCell(row.fgts)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    {fmtCell(row.decimo)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                    {fmtCell(row.ferias)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-800 bg-slate-50">
                    {fmtCell(row.totalEncargos)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/50">
                    R$ {fmt(row.custoHc)}
                  </td>
                  {row.phases.map((p, i) => (
                    <td
                      key={i}
                      className={`py-2.5 px-2 text-center font-mono ${
                        i === 2 ? 'bg-emerald-50/40' : ''
                      } ${p.cost === 0 ? 'text-slate-400' : ''}`}
                    >
                      <span className="font-bold text-slate-900">{p.hc}</span>
                      <span className="block text-[10px]">R$ {fmt(p.cost)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold">
                <td colSpan={9} className="py-3 px-3 uppercase text-right tracking-wide text-[10px]">
                  Total Folha Base + Pró-Labore Regular (encargos granularizados v3.6):
                </td>
                {PHASE_TOTALS.map((t, i) => (
                  <td
                    key={i}
                    className={`py-3 px-2 text-center font-mono text-sm ${
                      i === 2
                        ? 'text-emerald-300 bg-emerald-950'
                        : i === 3
                          ? 'text-indigo-300'
                          : 'text-amber-300'
                    }`}
                  >
                    {t.hc}
                    <span className="block text-[11px]">R$ {fmt(t.cost)}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* BENCHMARK REGIONAL & LEGISLAÇÃO SC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-2">
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>Convenção CCT Sintragon SC</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pisos salariais alinhados com o sindicato dos trabalhadores em transportes e logística de
            Itajaí/Navegantes. Inclui aditivo de periculosidade para operação em empilhadeiras elétricas
            acima de 500 kg.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-2">
            <Award className="w-4 h-4 text-emerald-700" />
            <span>Encargos CLT Simples Nacional</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Encargos diretos evidenciados: FGTS 8% + 13º 8,33% + Férias+1/3 11,11% ={' '}
            <strong>27,44%</strong>. INSS patronal diluído no DAS 6% (Anexo III) — fora desta matriz.
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-2">
            <FileCheck className="w-4 h-4 text-amber-700" />
            <span>Capacitação WMS & Licença NR-11</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Treinamento obrigatório para leitores Zebra, acuracidade de inventário rotativo &gt;99,8% e
            formação NR-11 para manuseio do porta-paletes KONNEN.
          </p>
        </div>
      </div>
    </div>
  );
};
