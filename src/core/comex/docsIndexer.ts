import fs from 'node:fs';
import path from 'node:path';
import type { ComexProcessRecord, ComexDocumentRecord } from '../../types/comex';
import type { ComexStore } from './comexStore';

export const BL_NUMBER_RE = /(\d{2}BRZ\d{7})/i;
export const DEFAULT_COMEX_DOC_FOLDERS = ['BL', 'DI', 'PI', 'PACKINGLIST'] as const;

export type ComexIndexedDocType = 'bl' | 'di' | 'pi' | 'packinglist' | 'other';

export interface ClassifiedComexFile {
  doc_type: ComexIndexedDocType;
  bl_number: string | null;
  file_name: string;
  folder: string;
}

export interface ComexIndexResult {
  root: string;
  scanned: number;
  documents: number;
  processes: number;
  linked: number;
  unlinked: number;
  skipped: number;
}

export function extractBlNumber(fileName: string): string | null {
  const match = fileName.match(BL_NUMBER_RE);
  return match ? match[1].toUpperCase() : null;
}

export function classifyComexFile(filePath: string): ClassifiedComexFile {
  const file_name = path.basename(filePath);
  const folder = path.basename(path.dirname(filePath));
  const folderKey = folder.replace(/[\s_-]/g, '').toUpperCase();
  const bl_number = extractBlNumber(file_name);

  let doc_type: ComexIndexedDocType = 'other';
  if (folderKey === 'PACKINGLIST' || /packing\s*list/i.test(file_name)) {
    doc_type = 'packinglist';
  } else if (folderKey === 'BL' || /^\s*BL\b/i.test(file_name)) {
    doc_type = 'bl';
  } else if (folderKey === 'DI' || /^\s*DI\b/i.test(file_name)) {
    doc_type = 'di';
  } else if (folderKey === 'PI' || /^\s*PI\b/i.test(file_name)) {
    doc_type = 'pi';
  }

  return { doc_type, bl_number, file_name, folder };
}

function pathExistsSafe(target: string): boolean {
  try {
    fs.accessSync(target, fs.constants.R_OK);
    return true;
  } catch {
    try {
      return fs.existsSync(target);
    } catch {
      return false;
    }
  }
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    if (!pathExistsSafe(dir)) return [];
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(
      `📁 Comex: skip scandir ${dir} — ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) out.push(...listFilesRecursive(full));
      else if (
        entry.isFile() &&
        !entry.name.startsWith('.') &&
        !entry.name.toUpperCase().startsWith('MANIFEST')
      ) {
        out.push(full);
      }
    } catch (err) {
      console.warn(
        `📁 Comex: skip entry ${full} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return out;
}

export async function indexComexDocuments(
  store: ComexStore,
  root: string,
): Promise<ComexIndexResult> {
  const absRoot = path.resolve(root);
  if (!pathExistsSafe(absRoot)) {
    return {
      root: absRoot,
      scanned: 0,
      documents: 0,
      processes: 0,
      linked: 0,
      unlinked: 0,
      skipped: 0,
    };
  }

  const files = listFilesRecursive(absRoot);
  const existing = await store.listProcesses();
  const byBl = new Map<string, ComexProcessRecord>();
  for (const proc of existing) {
    const bl = String(proc.payload.bl_number || '').toUpperCase();
    if (bl) byBl.set(bl, proc);
  }

  let skipped = 0;
  let linked = 0;
  let unlinked = 0;

  for (const filePath of files) {
    const classified = classifyComexFile(filePath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch (err) {
      skipped += 1;
      console.warn(
        `📁 Comex: skip stat ${filePath} — ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    let processId: string | null = null;

    if (classified.bl_number) {
      let proc = byBl.get(classified.bl_number);
      if (!proc) {
        proc = await store.createProcess({
          code: `BL-${classified.bl_number}`,
          payload: {
            type: 'importacao',
            bl_number: classified.bl_number,
            status: 'documentos_indexados',
            pucomex_status: 'Aguardando declaração',
          },
        });
        byBl.set(classified.bl_number, proc);
      }
      processId = proc.id;
    }

    await store.upsertDocument({
      process_id: processId,
      doc_type: classified.doc_type,
      file_name: classified.file_name,
      file_path: filePath,
      size_bytes: stat.size,
      meta: {
        bl_number: classified.bl_number,
        folder: classified.folder,
        mtime_ms: stat.mtimeMs,
      },
    });

    if (processId) linked += 1;
    else unlinked += 1;
  }

  const documents = await store.listDocuments();
  const processes = await store.listProcesses();

  return {
    root: absRoot,
    scanned: files.length,
    documents: documents.length,
    processes: processes.length,
    linked,
    unlinked,
    skipped,
  };
}

export function documentCounts(docs: ComexDocumentRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const doc of docs) {
    out[doc.doc_type] = (out[doc.doc_type] || 0) + 1;
  }
  return out;
}
