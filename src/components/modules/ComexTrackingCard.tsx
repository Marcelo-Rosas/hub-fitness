import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Satellite } from 'lucide-react';
import type { ComexTrackingKind, ComexTrackingRecord } from '../../types/comex';
import { MERCANTE_URL, PORTAL_UNICO_URL, TRACKING_KIND_LABEL } from '../../core/comex/integraComexPublic';
import { comexFetch } from './comexOperatorToken';

type TrackingStatus = 'alterado' | 'erro' | 'nao_encontrado' | 'aguardando' | 'sem_mudanca';
type TrackingRow = ComexTrackingRecord & { status: TrackingStatus };

export interface TrackingSummaryItem {
  changed: number;
  notFound: number;
  errors: number;
  lastCheck: string | null;
  changes: Array<{ doc_kind: ComexTrackingKind; doc_number: string; changed_at: string }>;
}

const KIND_LABEL: Record<ComexTrackingKind, string> = { ...TRACKING_KIND_LABEL };

const STATUS_STYLE: Record<TrackingStatus, { label: string; cls: string }> = {
  alterado: { label: 'Alterado', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  sem_mudanca: { label: 'Sem mudança', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  aguardando: { label: 'Aguardando 1ª consulta', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  nao_encontrado: { label: 'Não encontrado', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  erro: { label: 'Falha na consulta', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const INACTIVE = ['desembaracado', 'cancelado'];

const brt = (iso: string | null, withYear = true) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        ...(withYear ? { year: 'numeric' as const } : {}),
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const brtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—';

/** dataAtualizacao do Siscomex vem sem fuso (horário de Brasília): só reformata o texto. */
export function formatRemoteDate(raw: string | null, withYear = true): string {
  const m = raw ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw) : null;
  if (!m) return raw || '—';
  return `${m[3]}/${m[2]}${withYear ? `/${m[1]}` : ''} ${m[4]}:${m[5]}`;
}

/** Selo da lista de processos: âmbar "Alterado" / cinza "Não encontrado". */
export const TrackingBadge: React.FC<{ summary?: TrackingSummaryItem }> = ({ summary }) => {
  if (!summary) return null;
  if (summary.changed > 0) {
    const title = summary.changes
      .map((c) => `${KIND_LABEL[c.doc_kind]} ${c.doc_number} alterado em ${brt(c.changed_at, false)}`)
      .join('\n');
    return (
      <span
        title={title}
        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-200"
      >
        Alterado{summary.changed > 1 ? ` (${summary.changed})` : ''}
      </span>
    );
  }
  if (summary.notFound > 0) {
    return (
      <span
        title="Número não encontrado no Siscomex há mais de 7 dias — confira se está correto."
        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-300"
      >
        Não encontrado
      </span>
    );
  }
  return null;
};

/**
 * Cartão "Acompanhamento Siscomex" no modal do processo: data da última alteração
 * de CE/DI/LI/DUIMP (Integra Comex, consulta pública gratuita).
 */
export const ComexTrackingCard: React.FC<{
  processId: string;
  processStatus?: string | null;
  onChanged?: () => void;
}> = ({ processId, processStatus, onChanged }) => {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [nextCheckAt, setNextCheckAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inactive = INACTIVE.includes(String(processStatus || ''));

  const load = useCallback(async () => {
    try {
      const res = await comexFetch(`/api/comex/tracking?process_id=${encodeURIComponent(processId)}`);
      const j = await res.json();
      if (j?.success) {
        setRows(j.data);
        setNextCheckAt(j.scheduler?.nextCheckAt ?? null);
      } else setError(j?.error || 'Falha ao carregar o acompanhamento.');
    } catch {
      setError('Falha de rede ao carregar o acompanhamento.');
    }
  }, [processId]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await comexFetch('/api/comex/tracking/check', {
        method: 'POST',
        body: JSON.stringify({ process_id: processId }),
      });
      const j = await res.json();
      if (j?.success) {
        setRows(j.data);
        setNextCheckAt(j.scheduler?.nextCheckAt ?? null);
        onChanged?.();
      } else setError(j?.error || 'Falha ao verificar.');
    } catch {
      setError('Falha de rede ao verificar.');
    } finally {
      setBusy(false);
    }
  };

  const markSeen = async (id: string) => {
    try {
      const res = await comexFetch(`/api/comex/tracking/${encodeURIComponent(id)}/seen`, { method: 'POST' });
      const j = await res.json();
      if (j?.success) {
        setRows((prev) => prev.map((r) => (r.id === id ? j.data : r)));
        onChanged?.();
      } else setError(j?.error || 'Falha ao marcar como visto.');
    } catch {
      setError('Falha de rede ao marcar como visto.');
    }
  };

  const lastCheck = rows.reduce<string | null>((a, r) => (r.checked_at && (!a || r.checked_at > a) ? r.checked_at : a), null);
  const rowError = rows.find((r) => r.status === 'erro')?.last_error;

  return (
    <div className="p-3 bg-slate-50 rounded-xl border text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold flex items-center gap-1">
          <Satellite className="w-3.5 h-3.5 text-teal-600" /> Acompanhamento Siscomex
        </h4>
        <button
          type="button"
          disabled={busy || inactive || rows.length === 0}
          onClick={() => void checkNow()}
          className="py-1 px-2.5 rounded-lg bg-white border border-teal-200 text-teal-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Verificando…' : 'Verificar agora'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500">
          Informe Nº CE-Mercante, Nº DI, Nº LI ou a DUIMP e salve o processo para acompanhar as alterações.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-slate-500">
              <tr>
                <th className="py-1 pr-2">Documento</th>
                <th className="py-1 pr-2">Nº</th>
                <th className="py-1 pr-2">Última alteração no Siscomex</th>
                <th className="py-1 pr-2">Situação</th>
                <th className="py-1">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-2 font-semibold text-slate-700">{KIND_LABEL[r.doc_kind]}</td>
                  <td className="py-1.5 pr-2 font-mono text-[11px]">
                    {r.doc_number}
                    {r.doc_kind === 'duimp' && r.version ? ` v${r.version}` : ''}
                  </td>
                  <td className="py-1.5 pr-2">
                    {formatRemoteDate(r.remote_updated_at)}
                    {r.previous_remote_updated_at ? (
                      <span className="text-slate-500"> (antes: {formatRemoteDate(r.previous_remote_updated_at, false)})</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span
                      title={
                        r.status === 'nao_encontrado'
                          ? 'Número não encontrado no Siscomex — confira se está correto.'
                          : r.status === 'erro'
                            ? r.last_error || undefined
                            : undefined
                      }
                      className={`px-2 py-0.5 rounded-full border font-semibold text-[10px] ${STATUS_STYLE[r.status].cls}`}
                    >
                      {STATUS_STYLE[r.status].label}
                    </span>
                  </td>
                  <td className="py-1.5">
                    {r.status === 'alterado' ? (
                      <button
                        type="button"
                        onClick={() => void markSeen(r.id)}
                        className="text-teal-700 font-semibold hover:underline cursor-pointer"
                      >
                        Marcar como visto
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.some((r) => r.status === 'nao_encontrado') ? (
        <p className="text-slate-600">Número não encontrado no Siscomex — confira se está correto.</p>
      ) : null}
      {inactive ? <p className="text-slate-500">Processo encerrado — acompanhamento pausado.</p> : null}
      {error ? <p className="text-amber-800">{error}</p> : null}
      {!error && rowError ? <p className="text-rose-700">Última consulta falhou: {rowError}</p> : null}

      <p className="text-slate-600">
        O Siscomex informa só <strong>quando</strong> mudou, não <strong>o quê</strong>. Abra o Mercante ou o Portal
        Único para ver o detalhe.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={MERCANTE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Abrir o Mercante
        </a>
        <a href={PORTAL_UNICO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> Abrir o Portal Único
        </a>
      </div>
      <p className="text-[11px] text-slate-500">
        Verificado às {brtTime(lastCheck)} · próxima verificação {nextCheckAt ? `~${brtTime(nextCheckAt)}` : 'manual'} · fonte:
        SERPRO Integra Comex (consulta pública gratuita)
      </p>
    </div>
  );
};
