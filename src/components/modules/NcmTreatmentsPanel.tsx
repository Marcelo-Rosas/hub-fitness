import React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Landmark, ShieldAlert } from 'lucide-react';
import type { TaSummary, TtceNcmResult } from '../../core/comex/comexTreatments';

export interface NcmTreatmentsData {
  ncm: string;
  paisIso2: string;
  cliente: { id: string; legal_name: string; radar_modality: string | null } | null;
  ta: TaSummary | null;
  taError: string | null;
  ttce: TtceNcmResult | null;
  ttceError: string | null;
  ttcePaisConhecido: boolean;
  documentos: string[];
  simuladorUrl: string;
}

const card = 'p-4 bg-slate-50 rounded-xl border';

/** Cartões da Auditoria NCM com dados reais do Portal: LPCO/anuentes, tratamento tributário e documentos. */
export const NcmTreatmentsPanel: React.FC<{ data: NcmTreatmentsData }> = ({ data }) => {
  const { ta, ttce } = data;
  return (
    <div className="space-y-3">
      <div className={card}>
        <h4 className="font-bold mb-2 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> LPCO / Anuentes
          <span className="font-normal text-slate-500"> · Portal Único (simulação de tratamento administrativo)</span>
        </h4>
        {data.taError ? (
          <p className="text-amber-800">Não foi possível consultar: {data.taError}</p>
        ) : !ta || ta.itens.length === 0 ? (
          <p className="text-slate-600">Sem tratamento administrativo para esta NCM e origem.</p>
        ) : (
          <>
            {ta.impedeDesembaraco && (
              <p className="mb-2 font-semibold text-rose-700">
                Há licença que impede o desembaraço — obter o LPCO antes da chegada da carga.
              </p>
            )}
            <ul className="space-y-2">
              {ta.itens.map((it) => (
                <li key={it.numeroTa} className="flex gap-1.5">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${it.impedeDesembaraco ? 'text-rose-500' : 'text-amber-500'}`}
                  />
                  <div>
                    <span className="font-semibold">{it.orgao}</span> · {it.tipo}
                    {it.impedeDesembaraco ? ' · impede desembaraço' : ''}
                    {it.passivelInspecao ? ' · passível de inspeção' : ''}
                    {it.modelos.length > 0 && (
                      <div className="text-slate-600">
                        Modelos: {it.modelos.map((m) => `${m.codigo} — ${m.nome}`).join('; ')}
                      </div>
                    )}
                    {it.condicoes.length > 0 && <div className="text-slate-500">Quando: {it.condicoes.join('; ')}</div>}
                    {it.mensagem && <div className="text-slate-600">{it.mensagem}</div>}
                    <div className="text-[10px] text-slate-400">TA {it.numeroTa}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={card}>
        <h4 className="font-bold mb-2 flex items-center gap-1">
          <Landmark className="w-3.5 h-3.5 text-indigo-500" /> Tratamento tributário
          <span className="font-normal text-slate-500"> · TTCE (tributos e fundamentos — sem alíquotas)</span>
        </h4>
        {data.ttceError ? (
          <p className="text-amber-800">Não foi possível consultar: {data.ttceError}</p>
        ) : !ttce || (ttce.normais.length === 0 && ttce.opcionais.length === 0) ? (
          <p className="text-slate-600">Nenhum tratamento encontrado para esta NCM.</p>
        ) : (
          <div className="space-y-2">
            {!data.ttcePaisConhecido && (
              <p className="text-[11px] text-slate-500">
                Origem {data.paisIso2} sem código Siscomex mapeado: mostrando só tratamentos válidos para todas as origens.
              </p>
            )}
            <div>
              <div className="font-semibold">Tributos: {ttce.tributos.join(', ')}</div>
              <ul className="mt-1 space-y-0.5">
                {ttce.normais.map((t) => (
                  <li key={`${t.tributo}-${t.codigoFundamento}`} className="flex gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {t.tributo} · {t.regime} · {t.fundamento}
                    {t.exigeAtributos ? ' · DUIMP exige atributos' : ''}
                  </li>
                ))}
              </ul>
            </div>
            {ttce.opcionais.length > 0 && (
              <div>
                <div className="font-semibold">Benefícios / fundamentos opcionais</div>
                <ul className="mt-1 space-y-0.5">
                  {ttce.opcionais.map((t) => (
                    <li
                      key={`${t.tributo}-${t.codigoFundamento}`}
                      className={`flex gap-1.5 ${t.exTarifario ? 'font-semibold text-emerald-800' : ''}`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${t.exTarifario ? 'text-emerald-500' : 'text-slate-400'}`} />
                      {t.tributo} · {t.regime} · {t.fundamento} (cód. {t.codigoFundamento})
                      {t.exigeAtributos ? ' · exige atributos' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <a
          href={data.simuladorUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-indigo-700 font-semibold hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Calcular II/IPI/PIS/COFINS no simulador da Receita (NCM {data.ncm})
        </a>
      </div>

      <div className={card}>
        <h4 className="font-bold mb-2 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-indigo-500" /> Documentos
          <span className="font-normal text-slate-500">
            {' '}
            · {data.cliente ? `conforme o Radar de ${data.cliente.legal_name}` : 'selecione o cliente para ajustar DI/DUIMP'}
          </span>
        </h4>
        <ul className="space-y-1">
          {data.documentos.map((d) => (
            <li key={d} className="flex gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
