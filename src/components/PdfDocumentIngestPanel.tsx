import React, { useRef, useState } from 'react';
import { FileUp, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import type { ComexProcessRecord } from '../types/comex';

interface PdfDocumentIngestPanelProps {
  onPopulated: (process: ComexProcessRecord) => void;
}

export const PdfDocumentIngestPanel: React.FC<PdfDocumentIngestPanelProps> = ({ onPopulated }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingestFiles = async (files: FileList | File[]) => {
    const pdfs = [...files].filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) {
      setError('Envie PDF (BL, DI, PI ou Packing List).');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const lines: string[] = [];
    try {
      for (const file of pdfs) {
        const res = await fetch(
          `/api/comex/documents/ingest?fileName=${encodeURIComponent(file.name)}&apply=empty`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf' },
            body: await file.arrayBuffer(),
          },
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error || `Falha em ${file.name}`);
        lines.push(
          `${file.name} → ${json.result.docType} · ${json.result.processCode} · ${json.result.engine} · popular ${json.result.populated ? 'ok' : 'preview'}`,
        );
        if (json.data) onPopulated(json.data);
      }
      setLog(lines);
      setMsg(`${pdfs.length} PDF(s) → JSON → processo populado (fonte = documento).`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no ingest PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start gap-3">
        <FileUp className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            PDF → JSON → Popular
          </h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Fonte da verdade para BL, DI, PI e Packing List é o PDF — não Deep Research e não CSV.
            Envie o arquivo; o sistema classifica, extrai JSON e grava o processo.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-40 flex items-center gap-1.5"
        >
          <Sparkles className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Lendo PDF…' : 'Enviar PDF (BL / DI / PI / Packing List)'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void ingestFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {msg && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}
      {log.length > 0 && (
        <ul className="text-[11px] font-mono text-slate-600 space-y-0.5">
          {log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
