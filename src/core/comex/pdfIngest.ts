import fs from 'node:fs';
import path from 'node:path';
import type { ComexStore } from './comexStore';
import { classifyComexFile, extractBlNumber } from './docsIndexer';
import { extractPdfText, extractProcessFromPdfs, heuristicFieldsFromText, mergeExtracted } from './pdfExtract';

const TYPE_FOLDER: Record<string, string> = {
  bl: 'BL',
  di: 'DI',
  pi: 'PI',
  packinglist: 'PACKINGLIST',
  other: 'OUTROS',
};

function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[<>:"/\\|?*\u0000]/g, '_').trim();
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'documento'}.pdf`;
}

export interface PdfIngestResult {
  processId: string;
  processCode: string;
  docType: string;
  fileName: string;
  blNumber: string | null;
  engine: string;
  fields: Record<string, unknown>;
  populated: boolean;
}

export async function ingestPdfBuffer(options: {
  store: ComexStore;
  buffer: Buffer;
  fileName: string;
  docsRoot: string;
  apply?: 'empty' | 'replace' | 'preview';
}): Promise<PdfIngestResult> {
  const apply = options.apply || 'empty';
  const fileName = safeFileName(options.fileName);
  const classified = classifyComexFile(path.join(classifiedFolderGuess(fileName), fileName));
  const folder = TYPE_FOLDER[classified.doc_type] || 'OUTROS';
  const destDir = path.join(path.resolve(options.docsRoot), folder);
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, fileName);
  fs.writeFileSync(destPath, options.buffer);

  const text = await extractPdfText(destPath);
  const fromText = heuristicFieldsFromText(text);
  const blNumber =
    classified.bl_number ||
    (typeof fromText.fields.bl_number === 'string' ? fromText.fields.bl_number : null) ||
    extractBlNumber(text.slice(0, 4000));

  const processes = await options.store.listProcesses();
  let proc = blNumber
    ? processes.find((p) => String(p.payload.bl_number || '').toUpperCase() === blNumber)
    : undefined;
  if (!proc) {
    proc = await options.store.createProcess({
      code: blNumber ? `BL-${blNumber}` : undefined,
      payload: {
        type: 'importacao',
        bl_number: blNumber,
        status: 'documentos_indexados',
        pucomex_status: 'Aguardando declaração',
      },
    });
  }

  const doc = await options.store.upsertDocument({
    process_id: proc.id,
    doc_type: classified.doc_type,
    file_name: fileName,
    file_path: destPath,
    size_bytes: options.buffer.length,
    meta: { source: 'upload', bl_number: blNumber, folder },
  });

  const fresh = await options.store.getProcess(proc.id);
  const fieldDefs = await options.store.listFieldDefs('process');
  const docs = fresh?.documents?.length ? fresh.documents : [doc];
  const extracted = await extractProcessFromPdfs(docs, fieldDefs);

  let populated = false;
  if (apply !== 'preview') {
    const payload = mergeExtracted(fresh?.payload || proc.payload, extracted.fields, apply);
    await options.store.updateProcess(proc.id, { payload });
    populated = true;
  }

  const updated = await options.store.getProcess(proc.id);
  return {
    processId: proc.id,
    processCode: updated?.code || proc.code,
    docType: classified.doc_type,
    fileName,
    blNumber,
    engine: extracted.engine,
    fields: extracted.fields,
    populated,
  };
}

function classifiedFolderGuess(fileName: string): string {
  if (/packing\s*list/i.test(fileName)) return 'PACKINGLIST';
  if (/^\s*DI\b/i.test(fileName) || /\bDI\b/i.test(fileName)) return 'DI';
  if (/^\s*PI\b/i.test(fileName) || /\bPI\b/i.test(fileName)) return 'PI';
  if (/^\s*BL\b/i.test(fileName) || /\bBL\b/i.test(fileName)) return 'BL';
  return 'OUTROS';
}
