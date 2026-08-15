# GSD — Próximo ciclo (após skill + Shell + M18 scaffold)

**Status:** Pronto para abrir `/gsd`  
**Pré-requisito cumprido:** Spec 5 módulos · skill `hub-fitness` · Shell remapeado · M18 Comex stub

## Objetivo do próximo ciclo

Escolher **uma** trilha prioritária (não paralelizar as três no mesmo GSD):

### Trilha recomendada: Ponte B (Physical × Commercial)

| Fase | Objetivo | Arquivos | Done when |
|---|---|---|---|
| B1 | Spec campos contrato → billing | `docs/superpowers/specs/...-ponte-b.md` | Matriz evento→`billing_records` |
| B2 | Schema Operator billing deltas | `supabase/operator/` | Migration sem `tenant_id` |
| B3 | UI vínculo M14/M12 → M3 | módulos Comercial/Financeiro | Linha DRE rastreável a contrato |
| B4 | Testes + advisor context | `src/core/advisor/` | KPI billing no Gemini |

**Parallelizable:** B3 UI pode rodar após B2 schema.

### Alternativa A: Ponte A (Plan × Physical)

RPCs / eventos ASN + desova → stock Client DB. Depende de provision Client estável.

### Alternativa C: PUCOMEX live (Comex)

Substituir stubs `/api/comex/*` por autenticação e-CNPJ homolog Serpro. Só com certificado e política de secrets.

## Travas (não negociar no GSD)

- CAPEX 207.300
- Ad Valorem 0,10% sobre NF serviço
- Konnen ≠ âncora BE
- ADR-003 database-per-client

## Como iniciar

```
/gsd Ponte B: ligar eventos de capacidade/dwell e contratos a billing_records no Operator DB
```

Ou apontar explicitamente Ponte A / PUCOMEX live se a prioridade de negócio mudar.
