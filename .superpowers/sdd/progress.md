# SDD progress — intranet operator

Task 1: complete (no commit; .env.example + config.toml; VITE_SUPABASE_SECRET ausente; secret sem prefixo VITE_)
Task 2: complete — FSM pura, vitest verde
Task 3: complete — orgResolver TDD (COM→FIN→DIR; four-eyes; SEM_PERMISSAO)
Task 4: complete — apagada migration Client; `supabase/migrations/20260814160000_intranet_schema.sql`; adr003 verde
Task 5: complete — sqlite store + approvalService (sem Resend) + outboxDispatcher
Task 6: complete — rotas Express; ator = e-mail (`x-user-email`); role `compras`; dispatcher no listen
Task 7: complete — M19 abas Fila/Árvore/Cargos/Funcionários; M10 sem dropdown Decisor
Task 8: complete — compras.md + adr-003.md + memory/2026-08-14.md

Aceite local: `npx vitest run src/__tests__/intranet-rfq.test.ts src/__tests__/adr003-database-per-client.test.ts` — 20 testes verdes.
Não commitado (usuário não pediu).
