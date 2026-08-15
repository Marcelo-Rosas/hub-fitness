import React, { useEffect, useRef, useState } from 'react';
import { Copy, FileJson, Upload, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { parseResearchIngest, type IngestDomain, type IngestParseResult } from '../ingest';
import { COMPRAS_CLONE_TEMPLATES, type ComprasCloneTemplateId } from '../data/examples/comprasCloneTemplates';
import { SearchableSelect } from './ui/SearchableSelect';

interface ResearchIngestPanelProps {
  domain: IngestDomain;
  title?: string;
  hint?: string;
  disabled?: boolean;
  /** Quando muda, preenche o textarea (pesquisa in-app). */
  seedRaw?: string | null;
  onApply: (parsed: IngestParseResult) => Promise<void> | void;
}

export const ResearchIngestPanel: React.FC<ResearchIngestPanelProps> = ({
  domain,
  title = 'Ingestão Deep Research',
  hint,
  disabled,
  seedRaw,
  onApply,
}) => {
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<IngestParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [cloneId, setCloneId] = useState<ComprasCloneTemplateId>('rfq-stretch');
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSeedRef = useRef<string | null>(null);

  const handleParse = (text: string) => {
    setDoneMsg(null);
    try {
      const result = parseResearchIngest(text, domain);
      if (result.domain !== domain) {
        throw new Error(`Este JSON é de ${result.domain}, não de ${domain}.`);
      }
      setParsed(result);
      setError(null);
    } catch (err: unknown) {
      setParsed(null);
      setError(err instanceof Error ? err.message : 'Falha ao ler o pacote.');
    }
  };

  useEffect(() => {
    if (!seedRaw || seedRaw === lastSeedRef.current) return;
    lastSeedRef.current = seedRaw;
    setRaw(seedRaw);
    handleParse(seedRaw);
    setDoneMsg('Pacote da pesquisa in-app carregado — valide e aplique se estiver completo.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedRaw]);

  const handleCloneTemplate = () => {
    if (domain !== 'compras') {
      setError('Os clones de insumos AG são só do domínio compras.');
      return;
    }
    const tpl = COMPRAS_CLONE_TEMPLATES.find((t) => t.id === cloneId);
    if (!tpl) {
      setError('Selecione um template para clonar.');
      return;
    }
    setRaw(JSON.stringify(tpl.pack, null, 2));
    setParsed(null);
    setError(null);
    setDoneMsg(tpl.done);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    handleParse(text);
  };

  const handleApply = async () => {
    if (!parsed || disabled) return;
    if (parsed.pack.example) {
      setError(
        'Este JSON é exemplo/RFQ (example: true). Preencha preço + frete Itajaí e remova "example": true para gravar.',
      );
      return;
    }
    const zeroPrice = parsed.compras?.quotes.some((q) => q.unitPrice <= 0);
    if (zeroPrice) {
      setError('Há cotação com preço 0. RFQ incompleto — não grava no cadastro.');
      return;
    }
    const paleteLote = parsed.compras?.quotes.some(
      (q) => q.materialCategory.startsWith('Paletes') && q.monthlyVolumeUnit >= 300,
    );
    if (paleteLote) {
      setError('Palete com volume ≥300 parece lote inicial. Separe da reposição mensal antes de gravar.');
      return;
    }
    setBusy(true);
    try {
      await onApply(parsed);
      setDoneMsg(
        `${parsed.preview.length} linha(s) aplicadas · ${parsed.skipped.length} ignorada(s)`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao gravar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">{title}</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {hint ||
              'Pesquisa vive fora daqui (prompt/docs). Esta aba só ingere o JSON. BL/DI/PI/Packing List → PDF no M18.'}
          </p>
        </div>
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='Cole o JSON da pesquisa: {"domain":"compras","items":[...]}'
        className="w-full min-h-40 font-mono text-[11px] border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
        disabled={disabled}
      />

      <div className="flex flex-wrap items-center gap-2">
        {domain === 'compras' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56">
              <SearchableSelect
                value={cloneId}
                options={COMPRAS_CLONE_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
                onChange={(v) => setCloneId(v as ComprasCloneTemplateId)}
                disabled={disabled}
                placeholder="Template para clonar"
              />
            </div>
            <button
              type="button"
              onClick={handleCloneTemplate}
              disabled={disabled}
              className="px-3 py-2 border border-sky-300 bg-sky-50 text-sky-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40"
            >
              <Copy className="w-3.5 h-3.5" />
              Clonar (não grava)
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => handleParse(raw)}
          disabled={disabled || !raw.trim()}
          className="px-3 py-2 bg-[#1F3864] text-white text-xs font-bold rounded-lg disabled:opacity-40"
        >
          Validar JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="px-3 py-2 border border-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Soltar / escolher .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {parsed && (
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={
              disabled ||
              busy ||
              parsed.preview.length === 0 ||
              parsed.pack.example ||
              Boolean(parsed.compras?.quotes.some((q) => q.unitPrice <= 0)) ||
              Boolean(
                parsed.compras?.quotes.some(
                  (q) => q.materialCategory.startsWith('Paletes') && q.monthlyVolumeUnit >= 300,
                ),
              )
            }
            className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg disabled:opacity-40"
          >
            {busy ? 'Gravando…' : `Aplicar ${parsed.preview.length} no cadastro`}
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {doneMsg && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {doneMsg}
        </div>
      )}

      {parsed && (
        <div className="space-y-2">
          {parsed.warnings.map((w) => (
            <p key={w} className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              {w}
            </p>
          ))}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left py-1.5 px-2">Registro</th>
                  <th className="text-left py-1.5 px-2">Landed / detalhe</th>
                </tr>
              </thead>
              <tbody>
                {parsed.preview.map((row, i) => (
                  <tr key={`${row.label}-${i}`} className="border-t border-slate-100">
                    <td className="py-1.5 px-2 font-semibold">{row.label}</td>
                    <td className="py-1.5 px-2 text-slate-600">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.skipped.length > 0 && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <FileJson className="w-3.5 h-3.5" />
              Ignorados: {parsed.skipped.map((s) => `${s.ref} (${s.reason})`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
