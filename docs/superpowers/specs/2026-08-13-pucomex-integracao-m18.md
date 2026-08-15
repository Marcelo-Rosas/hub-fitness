# Integração PUCOMEX — M18 HUB-FITNESS

**Status:** Implementado (cliente live + fallback DEMO) · 2026-08-13  
**Docs:** [Portal Único API](https://docs.portalunico.siscomex.gov.br/) · [Auth](https://docs.portalunico.siscomex.gov.br/introducao-api-publica/) · [Ambientes](https://docs.portalunico.siscomex.gov.br/ambientes/)

## O que foi habilitado

1. Cliente Node mTLS (`PucomexClient`) com PFX A1
2. Sessão JWT/CSRF com renovação de headers e throttle 60s
3. Consultas DU-E, DUIMP, CCTA, NCM, Catálogo + proxy genérico
4. M18 exibe LIVE vs DEMO, Role-Type DEPOSIT, catálogo de endpoints
5. Variáveis em `.env.example`

## Go-live Validação

1. Obter e-CNPJ/e-CPF A1 habilitado no Portal (perfil Depositário)
2. Colocar PFX no servidor (fora do git)
3. `.env`:
   ```
   PUCOMEX_ENV=validacao
   PUCOMEX_ROLE_TYPE=DEPOSIT
   PUCOMEX_CERT_PFX_PATH=C:\certs\hub-fitness.pfx
   PUCOMEX_CERT_PASSWORD=***
   PUCOMEX_LIVE=true
   ```
4. Reiniciar `npm run dev` → M18 → Autenticar Portal
5. Consultar DUIMP de teste no ambiente val

## Fora de escopo ainda

- Registro/retificação completa DU-E XML (XSD) em UI
- Certificado A3 / token físico
- Webhooks/notificações push do Portal
- Sync processos → Client DB Supabase (próximo GSD)
