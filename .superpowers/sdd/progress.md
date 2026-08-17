# SDD progress — M6 Mix & Cenários unificado
Plan: docs/superpowers/plans/2026-08-16-m6-mix-cenarios-unificado.md
Branch: main
Note: Task subagents blocked (usage limits) — controller executed inline with plan gates.

Task 1: complete (ee39b5c..34c6293) — mixPreview + 6 vitest
Task 2: complete (34c6293..8c1ffb6) — PlannerContext preview pipeline + commitMixPreview
Task 3–5: complete (8c1ffb6..69240da) — M6MixCenarios shell, M11 redirect, CoA readOnly, sidebar, RBAC
Task 6: smoke partial — Railway SUCCESS `e3558449` via `railway up` cwd upload (GitHub fork still wrong for auto-deploy)

## Smoke live 2026-08-16 (hub.vectracargo.com.br)

PASS:
1. Sidebar Mix & Cenários M6 under Financeiro; no M11
3. Blend Conservador → badge MIX PENDENTE + Matriz banner; no ledger PUT in resource log (only scenarios/bundle)
5. Discard → badge clear; sliders back to 20/30/25/25; Descartar disabled
Vitest slice: 56/56 pass

FAIL / gap:
2. `?module=M11&tab=enquadramento` stayed on M1 — `activeModule` never hydrated from URL (RedirectM11 never mounts)
6. CoA tab opens; banner text in code; CRUD UI still visible (known Task 5 minimal)
4. Commit not smoke-tested on prod (ledger write)
7. Drivers autosave not exercised

Fix staged local: `PlannerContext` init `activeModule` from `?module=` — needs commit + railway up to verify redirect.
