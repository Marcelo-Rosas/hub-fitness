import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GoogleGenAI } from '@google/genai';
import type { ComexDocumentRecord, ComexFieldDef } from '../../types/comex';
import { COMEX_PORTS_DATA } from '../../data/comexPortsData';

export interface PdfExtractResult {
  fields: Record<string, unknown>;
  extra: Record<string, unknown>;
  json: Record<string, unknown>;
  sources: Array<{ id: string; file_name: string; doc_type: string; chars: number }>;
  engine: 'heuristic' | 'heuristic+gemini';
  textPreview: string;
}

const BL_RE = /(\d{2}BRZ\d{7})/i;
const NCM_RE = /\b(9506(?:[.\s]?\d{2}){1,2})\b/;
const INCOTERM_RE = /\b(FOB|CIF|FCA|DDP|EXW)\b/i;
const USD_RE = /(?:USD|US\$|FOB)\s*[:\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i;

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function matchAfter(text: string, label: RegExp, take = 120): string | null {
  const m = text.match(label);
  if (!m || m.index == null) return null;
  const slice = text.slice(m.index + m[0].length, m.index + m[0].length + take);
  const line = slice.split(/\n/)[0] || slice;
  return collapse(line).replace(/^[:.\-\s]+/, '') || null;
}

function findPortCode(text: string, side: 'origin' | 'dest'): string | null {
  const upper = text.toUpperCase();
  const fromTo = upper.match(/FROM\s*[:.]?\s*([A-ZÇÃÕÁÉÍÓÚ /,-]+?)\s+TO\s*[:.]?\s*([A-ZÇÃÕÁÉÍÓÚ /,-]+?)(?:\s+BY\s|\n|$)/);
  const hay = side === 'origin' ? fromTo?.[1] || upper : fromTo?.[2] || upper;
  const ranked = side === 'origin'
    ? COMEX_PORTS_DATA.filter((p) => !p.codigo.startsWith('BR'))
    : COMEX_PORTS_DATA.filter((p) => p.codigo.startsWith('BR'));
  for (const port of ranked) {
    const name = port.descricao.replace(/Á/g, 'A').replace(/Í/g, 'I').replace(/Ó/g, 'O');
    if (hay.includes(port.descricao) || hay.includes(name) || hay.includes(port.codigo)) {
      return port.codigo;
    }
  }
  if (side === 'origin' && /QINGDAO|QING DAO/.test(hay)) return 'CNQIN';
  if (side === 'dest' && /ITAJAI|ITAJAÍ/.test(hay)) return 'BRITJ';
  return null;
}

function parseUsd(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function productLines(text: string): string[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const names: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\s+([A-Z0-9]+)\s+(.+?)\s+(BRTW\d+)/i);
    if (m) names.push(`${m[1]} ${m[2].trim()}`);
  }
  return [...new Set(names)].slice(0, 8);
}

export function heuristicFieldsFromText(text: string): { fields: Record<string, unknown>; extra: Record<string, unknown> } {
  const fields: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  const bl = text.match(BL_RE)?.[1]?.toUpperCase();
  if (bl) fields.bl_number = bl;

  const ncmRaw = text.match(NCM_RE)?.[1];
  if (ncmRaw) {
    const digits = ncmRaw.replace(/\D/g, '');
    fields.ncm_code = digits.length === 8 ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}` : ncmRaw;
  } else if (/fitness|chest press|leg press|squat|trainer|muscul/i.test(text)) {
    fields.ncm_code = '9506.91.00';
  }

  const incoterm = text.match(INCOTERM_RE)?.[1]?.toUpperCase();
  if (incoterm) fields.incoterm = incoterm;

  const origin = findPortCode(text, 'origin');
  const dest = findPortCode(text, 'dest');
  if (origin) fields.port_of_origin_code = origin;
  if (dest) fields.port_of_destination_code = dest;

  if (/BRAZIL|BRASIL|ITAJAI|NAVEGANTES|ITAPOA/i.test(text)) {
    fields.type = 'importacao';
  }

  const orderBy = matchAfter(text, /ORDER\s*BY\s*[:.]?/i, 80);
  const consignee = matchAfter(text, /CONSIGNE[ES]+\s*[:.]?/i, 80);
  if (orderBy) {
    extra.order_by = orderBy;
    fields.client_name = /KONNEN/i.test(orderBy) ? 'Konnen' : orderBy.split(/CNPJ|,/)[0].trim();
  }
  if (consignee) extra.consignee = consignee;

  const invoice = matchAfter(text, /INVOICE\s*NO\.?\s*[:.]?/i, 40);
  if (invoice) extra.invoice_no = invoice.split(/\s{2,}/)[0];

  const containers = [...text.matchAll(/\b([A-Z]{4}\d{7})\b/g)].map((m) => m[1]);
  if (containers.length) extra.containers = [...new Set(containers)];

  const products = productLines(text);
  if (products.length) {
    extra.products = products;
    fields.product_description = products.join('; ');
  }

  const usd = parseUsd(text.match(USD_RE)?.[1] || null);
  if (usd) fields.fob_value_usd = usd;

  if (dest === 'BRITJ' || dest === 'BRNVT') {
    fields.customs_house =
      dest === 'BRITJ' ? '0817800 - URF Itajaí' : '0817600 - URF Navegantes / Itajaí';
  } else if (dest === 'BRIOA') {
    fields.customs_house = '0817700 - URF Itapoá';
  }

  fields.status = 'documentos_indexados';
  fields.pucomex_status = 'Aguardando declaração';

  const noteBits = [
    extra.invoice_no ? `Invoice ${extra.invoice_no}` : null,
    extra.order_by ? `Order by ${extra.order_by}` : null,
    extra.consignee ? `Consignee ${extra.consignee}` : null,
    Array.isArray(extra.containers) ? `${(extra.containers as string[]).length} ctr` : null,
  ].filter(Boolean);
  if (noteBits.length) fields.notes = noteBits.join(' · ');

  return { fields, extra };
}

function pythonExtract(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const script =
      'import sys\nfrom pypdf import PdfReader\nr=PdfReader(sys.argv[1])\nprint("\\n".join((p.extract_text() or "") for p in r.pages))';
    const child = spawn('python', ['-c', script, filePath], { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || `python pdf exit ${code}`));
    });
  });
}

export async function extractPdfText(filePath: string): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const bytes = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '');
    if (text.trim().length > 40) return text;
  } catch {
    /* fallback python */
  }
  return pythonExtract(filePath);
}

function pickKnownKeys(input: Record<string, unknown>, fieldDefs: ComexFieldDef[]): Record<string, unknown> {
  const allowed = new Set(fieldDefs.map((f) => f.field_key));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    if (value == null || value === '') continue;
    out[key] = value;
  }
  return out;
}

async function geminiRefine(
  docs: Array<{ file_path: string; file_name: string; doc_type: string }>,
  fieldDefs: ComexFieldDef[],
  heuristic: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  const ai = new GoogleGenAI({ apiKey });
  const keys = fieldDefs.map((f) => `${f.field_key} (${f.label}, ${f.data_type})`).join('\n');
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Extraia dados de documentos Comex (BL/DI/PI/Packing List) para JSON.
Use SOMENTE estas chaves de campo (metadado do projeto):
${keys}

Regras:
- type: importacao ou exportacao
- port_of_origin_code / port_of_destination_code: código UN/LOCODE 5 letras se possível (ex CNQIN, BRITJ, BRNVT)
- ncm_code no formato 9506.91.00
- números sem milhar com ponto; decimal com ponto
- se não encontrar, omita a chave
- não invente número de DUIMP
Heurística local (pode corrigir): ${JSON.stringify(heuristic)}
Responda APENAS JSON.`,
    },
  ];
  for (const doc of docs.slice(0, 3)) {
    const buf = fs.readFileSync(doc.file_path);
    if (buf.length > 8_000_000) continue;
    parts.push({ text: `Arquivo ${doc.doc_type}: ${doc.file_name}` });
    parts.push({ inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } });
  }
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    contents: [{ role: 'user', parts }],
    config: { temperature: 0.1, responseMimeType: 'application/json' },
  });
  const raw = response.text || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

export function mergeExtracted(
  current: Record<string, unknown>,
  extracted: Record<string, unknown>,
  mode: 'empty' | 'replace',
): Record<string, unknown> {
  const next = { ...current };
  for (const [key, value] of Object.entries(extracted)) {
    if (value == null || value === '') continue;
    const existing = next[key];
    const vacant = existing == null || existing === '';
    if (mode === 'replace' || vacant) next[key] = value;
  }
  return next;
}

export async function extractProcessFromPdfs(
  docs: ComexDocumentRecord[],
  fieldDefs: ComexFieldDef[],
): Promise<PdfExtractResult> {
  const ordered = [...docs].sort((a, b) => {
    const rank = (t: string) => ({ bl: 0, packinglist: 1, pi: 2, di: 3 }[t] ?? 9);
    return rank(a.doc_type) - rank(b.doc_type);
  });
  const sources: PdfExtractResult['sources'] = [];
  const texts: string[] = [];
  for (const doc of ordered) {
    if (!doc.file_path || !fs.existsSync(doc.file_path)) continue;
    if (path.extname(doc.file_path).toLowerCase() !== '.pdf') continue;
    const text = await extractPdfText(doc.file_path);
    sources.push({ id: doc.id, file_name: doc.file_name, doc_type: doc.doc_type, chars: text.length });
    texts.push(`FILE ${doc.file_name}\n--- ${doc.doc_type.toUpperCase()} ---\n${text}`);
  }
  if (!texts.length) {
    throw new Error('Nenhum PDF legível ligado a este processo');
  }
  const blob = texts.join('\n\n');
  const heuristic = heuristicFieldsFromText(blob);
  let fields = pickKnownKeys(heuristic.fields, fieldDefs);
  let engine: PdfExtractResult['engine'] = 'heuristic';
  try {
    const refined = await geminiRefine(
      ordered.filter((d) => fs.existsSync(d.file_path)),
      fieldDefs,
      fields,
    );
    if (refined) {
      fields = pickKnownKeys({ ...fields, ...refined }, fieldDefs);
      engine = 'heuristic+gemini';
    }
  } catch (err) {
    console.warn('[comex extract] Gemini indisponível:', err instanceof Error ? err.message : err);
  }
  const json = { ...heuristic.extra, ...fields };
  return {
    fields,
    extra: heuristic.extra,
    json,
    sources,
    engine,
    textPreview: blob.slice(0, 1800),
  };
}
