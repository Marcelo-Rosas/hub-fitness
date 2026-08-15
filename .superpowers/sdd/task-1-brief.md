# Task 1: Parametrizar env e superfície Supabase

Work from: `c:\Users\marce\hub-fitness`

**Files:**
- Modify: `.env.example`
- Modify: `supabase/config.toml` (só comentar que `intranet` não entra em `schemas`)
- Test: grep no repo por `VITE_SUPABASE_SECRET` (não deve existir)

- [ ] **Step 1:** Em `.env.example`, após o bloco Comex, deixar explícito:

```
# Browser (Vite) — nunca secret
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# Express — Operator
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SECRET_KEY="sb_secret_..."
SUPABASE_SCHEMA_INTRANET="intranet"
# DATABASE_URL="postgresql://postgres:...@db.YOUR_PROJECT.supabase.co:5432/postgres"

# Intranet
# INTRANET_DB_PATH="data/intranet.sqlite"
# INTRANET_EMAIL_LIVE="false"
```

Keep existing Comex comments. Merge with the existing Intranet block (INTRANET_EMAIL_LIVE, RESEND_*) — do not delete Resend keys. Place Vite/Express Supabase keys as specified; keep GEMINI/Google/PUCOMEX blocks intact.

- [ ] **Step 2:** Confirmar `[api] schemas = ["public", "graphql_public"]` em `supabase/config.toml`. Adicionar comentário: `# intranet = schema privado; não listar aqui`.

- [ ] **Step 3:** Verificar que `.env` local já tem `VITE_SUPABASE_URL` + publishable e que `SUPABASE_SECRET_KEY` **não** tem prefixo `VITE_`. Não commitar `.env`. Do not print secret values in the report.

Grep: `VITE_SUPABASE_SECRET` must not exist anywhere in the repo (except maybe this brief).

**Do NOT git add/commit.** The parent git is the user home directory.

**Language:** file comments in pt-BR. Report in pt-BR.
