import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { SearchableSelect } from './ui/SearchableSelect';
import { ResearchIngestPanel } from './ResearchIngestPanel';
import { parseResearchIngest, type IngestParseResult } from '../ingest';
import {
  accountByCode,
  comprasCoaOptions,
} from '../core/compras/researchFromCoa';

interface ComprasPesquisaPanelProps {
  disabled?: boolean;
  amplifyNote?: string | null;
  onClearAmplify?: () => void;
  /** Após ingest: abre Comparador com a conta CoA. */
  onGoComparador?: (accountCode: string) => void;
  onApply: (parsed: IngestParseResult) => Promise<void> | void;
}

export const ComprasPesquisaPanel: React.FC<ComprasPesquisaPanelProps> = ({
  disabled,
  amplifyNote,
  onClearAmplify,
  onGoComparador,
  onApply,
}) => {
  const [coaCode, setCoaCode] = useState('5.1.01.03');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [seedRaw, setSeedRaw] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);

  const coaOpts = useMemo(() => comprasCoaOptions(), []);
  const account = accountByCode(coaCode);

  const finishToComparador = async (parsed: IngestParseResult, note: string) => {
    await onApply(parsed);
    setInfo(note);
    setHasResult(true);
    const quotes = parsed.compras?.quotes || [];
    const fromQuotes =
      quotes.find((q) => q.accountCode)?.accountCode || quotes[0]?.accountCode;
    onGoComparador?.(fromQuotes || coaCode);
  };

  const handleRunResearch = async () => {
    if (!account) {
      setErr('Selecione uma conta do Plano de Contas.');
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch('/api/gemini/compras-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountCode: coaCode,
          amplifyNote: amplifyNote || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Falha na pesquisa.');
      }
      const pack = json.pack;
      if (!pack) throw new Error('Resposta sem pacote JSON.');
      const text = JSON.stringify(pack, null, 2);
      setSeedRaw(text);

      const parsed = parseResearchIngest(text, 'compras');
      if (!parsed.compras?.quotes.length) {
        setHasResult(true);
        setInfo('Pesquisa sem cotações mapeáveis no eixo SP/PR/SC. Revise o JSON.');
        return;
      }

      const draftish = Boolean(pack.example) || parsed.compras.quotes.some((q) => q.unitPrice <= 0);
      if (draftish && parsed.compras.quotes.every((q) => q.unitPrice <= 0)) {
        setHasResult(true);
        setSeedRaw(text);
        setErr(
          'Pesquisa voltou sem preço (R$ 0). Folha RFQ não entra no Comparador como cotação. Rode de novo com Gemini live ou use fallback de estimativa.',
        );
        setInfo(
          json.isSimulated
            ? 'Resposta simulada/offline. Se persistir, reinicie o server após atualizar o pack de pesquisa.'
            : 'Modelo devolveu preço 0 — pedir cotação na aba 4 sem poluir o Comparador.',
        );
        return;
      }

      const note = draftish
        ? `Rascunho no Comparador (${parsed.compras.quotes.length} cotação(ões)${json.isSimulated ? ' · simulado' : ''}). Preço parcial / example — Sync DRE só após RFQ aprovada.`
        : `Pesquisa aplicada (${parsed.compras.quotes.length} cotação(ões)${json.isSimulated ? ' · estimativa offline' : ''}) — abrindo Comparador.`;

      await finishToComparador(parsed, note);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao executar pesquisa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Pesquisa · Plano de Contas
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Conta → Executar pesquisa → ingest no cadastro de cotações → Comparador (passo 2).
            </p>
          </div>
        </div>

        {amplifyNote ? (
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">Ampliação por reprovação / correção</p>
              <p className="whitespace-pre-wrap">{amplifyNote}</p>
              {onClearAmplify && (
                <button
                  type="button"
                  onClick={onClearAmplify}
                  className="text-amber-800 underline font-semibold cursor-pointer"
                >
                  Limpar observação
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Conta do Plano</label>
            <SearchableSelect
              value={coaCode}
              options={coaOpts}
              onChange={setCoaCode}
              disabled={disabled || busy}
              required
              placeholder="Filtrar 5.1.01…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRunResearch()}
              disabled={disabled || busy || !account}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg disabled:opacity-40 cursor-pointer flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? 'Pesquisando…' : 'Executar pesquisa'}
            </button>
            {hasResult && onGoComparador && (
              <button
                type="button"
                onClick={() => onGoComparador(coaCode)}
                className="px-4 py-2.5 bg-[#1F3864] hover:bg-[#2b4b80] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                Ir ao Comparador <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {account && (
          <p className="text-[11px] text-slate-500">
            Escopo: <strong>{account.code}</strong> · {account.name}
            {account.notes ? ` — ${account.notes}` : ''}
          </p>
        )}

        {err && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {err}
          </div>
        )}
        {info && (
          <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
            {info}
          </div>
        )}
      </div>

      <ResearchIngestPanel
        domain="compras"
        title="Resultado da pesquisa · JSON"
        hint="Executar pesquisa já ingere no Comparador. Aqui: ajustar JSON / Clonar. Sync DRE continua bloqueado com example/preço 0 até RFQ aprovada."
        disabled={disabled}
        seedRaw={seedRaw}
        onApply={async (parsed) => {
          await onApply(parsed);
          setHasResult(true);
          onGoComparador?.(coaCode);
        }}
      />
    </div>
  );
};
