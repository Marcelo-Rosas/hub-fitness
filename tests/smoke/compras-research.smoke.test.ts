import { describe, it, expect } from 'vitest';
import { parseResearchIngest } from '../../src/ingest';

const LIVE = process.env.SMOKE_LIVE_URL ?? 'https://hub.vectracargo.com.br';

describe('smoke live compras-research', () => {
  it(
    'POST /api/gemini/compras-research 5.1.01.03 → 3 cotações Fitas PET',
    async () => {
      const res = await fetch(`${LIVE}/api/gemini/compras-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountCode: '5.1.01.03' }),
      });
      expect(res.ok, `HTTP ${res.status}`).toBe(true);
      const json = (await res.json()) as {
        success: boolean;
        pack?: { domain?: string; items?: unknown[] };
      };
      expect(json.success).toBe(true);
      const parsed = parseResearchIngest(JSON.stringify(json.pack), 'compras');
      expect(parsed.compras?.quotes.length).toBe(3);
      expect(parsed.compras?.quotes.every((q) => q.materialCategory === 'Fitas PET')).toBe(true);
      expect(parsed.compras?.quotes.every((q) => q.accountCode === '5.1.01.03')).toBe(true);
      expect(parsed.compras?.quotes.every((q) => q.unitPrice > 0)).toBe(true);
      expect(parsed.compras?.quotes.every((q) => q.totalMonthlyWithFreight > 0)).toBe(true);
      expect(
        parsed.compras?.quotes.every(
          (q) =>
            /fita|pet|arquear/i.test(q.productDescription) &&
            !/loca[cç][aã]o|empilh|retr[aá]til/i.test(q.productDescription),
        ),
      ).toBe(true);
    },
    120_000,
  );
});
