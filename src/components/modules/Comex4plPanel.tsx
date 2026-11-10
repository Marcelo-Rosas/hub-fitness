import React, { useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { linhaDoTempo4pl } from '../../core/comex4pl';
import { aliqInterna, ICMS_UF, PROGRAMAS_IMPORTACAO, UFS, type UF } from '../../core/icmsUf';
import { CONFORMIDADE_IMPORTACAO_DIRETA, SIMULACAO_REFERENCIA } from '../../core/importCost';

const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
const pct = (f: number) => `${(f * 100).toFixed(1).replace('.', ',')}%`;

/** 4PL comex: linha do tempo da modalidade (direta × encomenda) + receita do Hub no DRE. */
export const Comex4plPanel: React.FC = () => {
  const { hubParams, setHubParams } = usePlanner();
  const [uf, setUf] = useState<UF>('RJ');
  const [progId, setProgId] = useState('sc-ttd');
  const [processosSemestre, setProcessosSemestre] = useState(1);
  const c4 = hubParams.comex4pl;

  const input = useMemo(
    () => ({ ...SIMULACAO_REFERENCIA, honorarioHub: { tipo: 'fixo' as const, valor: c4.honorarioPorProcesso } }),
    [c4.honorarioPorProcesso],
  );
  const linha = useMemo(
    () => linhaDoTempo4pl(input, uf, progId, { processosSemestre, margemMinimaTroca: 0.01 }),
    [input, uf, progId, processosSemestre],
  );
  const set4pl = (patch: Partial<typeof c4>) =>
    setHubParams((p) => ({ ...p, comex4pl: { ...p.comex4pl, ...patch } }));
  const num = (k: keyof typeof c4) => (e: React.ChangeEvent<HTMLInputElement>) => set4pl({ [k]: Number(e.target.value) });

  const receitaY2 = c4.processosMesY2 * c4.honorarioPorProcesso * 12;

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">🚢 4PL — receita de gestão porta a porta no plano</h3>
        <p className="text-xs text-slate-500">
          Hub vende só serviço (NFS-e): nunca importa, compra ou revende. Receita entra no RBT12, DAS e Fator R.
        </p>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={c4.ativo} onChange={(e) => set4pl({ ativo: e.target.checked })} />
          Incluir receita 4PL no DRE
        </label>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          {([
            ['inicioMes', 'Início (mês)'],
            ['processosMesY1', 'Processos/mês Ano 1'],
            ['processosMesY2', 'Processos/mês Ano 2'],
            ['honorarioPorProcesso', 'Honorário/processo (R$)'],
            ['custoPctReceita', 'Custo direto (fração)'],
            ['folhaPctCusto', 'Folha no custo (Fator R)'],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <span className="text-slate-600">{label}</span>
              <input
                type="number"
                step={k === 'custoPctReceita' || k === 'folhaPctCusto' ? 0.05 : 1}
                value={c4[k]}
                onChange={num(k)}
                className="w-full mt-1 px-2 py-1 border border-slate-300 rounded font-mono"
              />
            </label>
          ))}
        </div>
        <div className="text-[11px] text-slate-600">
          Ano 2: {brl(receitaY2)}/ano de receita · referência de mercado: consultoria R$ 25,5 mil líquidos/processo;
          trading ≈ 2% do valor aduaneiro (~R$ 4,7 mil). HIPÓTESE.
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">📅 Linha do tempo da modalidade (2026–2033)</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <label>
            UF da academia{' '}
            <select value={uf} onChange={(e) => setUf(e.target.value as UF)} className="border rounded px-1 py-0.5">
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u} · {pct(aliqInterna(u))}{ICMS_UF[u].validar ? ' ⚠' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trading parceira{' '}
            <select value={progId} onChange={(e) => setProgId(e.target.value)} className="border rounded px-1 py-0.5">
              {PROGRAMAS_IMPORTACAO.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Processos/semestre{' '}
            <input
              type="number" min={1} value={processosSemestre}
              onChange={(e) => setProcessosSemestre(Math.max(1, Number(e.target.value)))}
              className="w-14 border rounded px-1 py-0.5 font-mono"
            />
          </label>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1">Ano</th>
              <th className="py-1">Modalidade</th>
              <th className="py-1 text-right">Direta</th>
              <th className="py-1 text-right">Encomenda</th>
              <th className="py-1 text-right">Economia</th>
              <th className="py-1 pl-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {linha.map((l) => (
              <tr key={l.ano} className="border-b border-slate-100">
                <td className="py-1 font-bold">{l.ano}</td>
                <td className={`py-1 font-bold ${l.modalidade === 'encomenda' ? 'text-emerald-700' : 'text-slate-800'}`}>
                  {l.modalidade === 'encomenda' ? 'Encomenda (trading)' : 'Direta (Radar academia)'}
                </td>
                <td className="py-1 text-right font-mono">{brl(l.custoDireta)}</td>
                <td className="py-1 text-right font-mono">{l.custoEncomenda == null ? '—' : brl(l.custoEncomenda)}</td>
                <td className="py-1 text-right font-mono">{brl(l.economia)}</td>
                <td className="py-1 pl-3 text-slate-500">{l.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-500">
          Carga de referência US$ 40 mil FOB (9506.91.00), mesmo honorário do Hub nas duas modalidades + fee da trading
          (2% VA) na encomenda; troca só com ganho ≥ 1%. Incentivos e IPI zero 2027 (exceto ZFM) são HIPÓTESES —
          validar com tributarista. Tema 520: conta e ordem não aproveita incentivo da trading.
        </p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h4 className="text-xs font-bold text-slate-900 mb-2">✅ Conformidade — importação direta</h4>
        <ul className="space-y-1 text-xs list-disc pl-5">
          {CONFORMIDADE_IMPORTACAO_DIRETA.map((c) => (
            <li key={c.id}>{c.item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
