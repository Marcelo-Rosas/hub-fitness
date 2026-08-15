import { describe, it, expect } from 'vitest';
import { classifyComexFile, extractBlNumber } from '../core/comex/docsIndexer';
import { heuristicFieldsFromText, mergeExtracted } from '../core/comex/pdfExtract';
import { SqliteComexStore, consultValueFromProcess } from '../core/comex/comexStore';

describe('Comex indexer', () => {
  it('extrai BL 06BRZ2311010 do nome', () => {
    expect(extractBlNumber('BL 06BRZ2311010.pdf')).toBe('06BRZ2311010');
  });

  it('classifica pela pasta (Packing List vence nome com BL)', () => {
    const packing = classifyComexFile('D:\\Comex\\PACKINGLIST\\BL 06BRZ2311010 packing list.pdf');
    expect(packing.doc_type).toBe('packinglist');
    expect(packing.bl_number).toBe('06BRZ2311010');

    const bl = classifyComexFile('D:\\Comex\\BL\\BL 06BRZ2311010.pdf');
    expect(bl.doc_type).toBe('bl');

    const pi = classifyComexFile('D:\\Comex\\PI\\PI 06BRZ2311010.pdf');
    expect(pi.doc_type).toBe('pi');
  });
});

describe('PDF → JSON heurística', () => {
  it('alimenta field_keys a partir de packing list Brightway/Konnen', () => {
    const text = `
Packing list
INVOICE NO.: BRTW2407ZY-1
CONSIGNESS: GARRA TRADE IMPORTACAO E EXPORTACAO LTDA
ORDER BY:    KONNEN COMERCIO DE FERRAMENTAS  LTDA
FROM:QINGDAO,CHINA              TO: ITAJAI, BRAZIL      BY SEA
CONTAINER NO 1# 40HC: MSMU8879280
1 TN01 Incline chest press BRTW2407ZY 6 6 912 1062 6,18
BL 06BRZ2411003
`;
    const { fields, extra } = heuristicFieldsFromText(text);
    expect(fields.bl_number).toBe('06BRZ2411003');
    expect(fields.type).toBe('importacao');
    expect(fields.client_name).toBe('Konnen');
    expect(fields.ncm_code).toBe('9506.91.00');
    expect(fields.port_of_origin_code).toBe('CNQIN');
    expect(fields.port_of_destination_code).toBe('BRITJ');
    expect(extra.invoice_no).toMatch(/BRTW2407ZY/);
    expect(mergeExtracted({ bl_number: 'KEEP' }, fields, 'empty').bl_number).toBe('KEEP');
    expect(mergeExtracted({ bl_number: 'KEEP' }, fields, 'replace').bl_number).toBe('06BRZ2411003');
  });
});

describe('Comex sqlite store metadado', () => {
  it('grava processo em payload e field_defs no DB', async () => {
    const store = new SqliteComexStore(':memory:');
    await store.ensureReady();
    const fields = await store.listFieldDefs('process');
    expect(fields.length).toBeGreaterThan(5);
    expect(fields.some((f) => f.consult_key)).toBe(true);

    const proc = await store.createProcess({
      payload: { bl_number: '06BRZ2311010', type: 'importacao', declaration_number: '26BR000031940-2' },
    });
    expect(proc.payload.bl_number).toBe('06BRZ2311010');
    const consult = consultValueFromProcess(proc, fields);
    expect(consult?.kind).toBe('duimp');
    expect(consult?.number).toBe('26BR000031940-2');
  });
});
