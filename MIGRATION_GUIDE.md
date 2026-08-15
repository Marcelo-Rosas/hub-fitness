# 🚀 HUB-SIM v3.5 — Guia de Migração de Produção e Deploy Externo

Este documento detalha os passos para retirar o ecossistema **HUB-SIM (3PL Fitness Hub Itajaí)** do ambiente de sandbox (AI Studio) e realizar a implantação (deploy) em um ambiente de produção real.

---

## 📋 1. Pré-Requisitos do Ambiente
- **Node.js**: v18.x ou v20.x LTS
- **npm**: v9.x ou superior
- **Git**: Para controle de versão e integração CI/CD

---

## 🛠️ 2. Instalação e Configuração Local

### Step 1: Clonar e Instalar Dependências
```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd hub-sim
npm install
```

### Step 2: Configurar Variáveis de Ambiente (`.env`)
Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
# Servidor Express
PORT=3000
NODE_ENV=development

# Inteligência Artificial (Google Gemini SDK)
GEMINI_API_KEY=sua_chave_gemini_aqui

# Autenticação JWT / Supabase (Para Ativação em Produção)
JWT_SECRET=seu_segredo_jwt_super_seguro_v35
SUPABASE_URL=https://sua-instancia.supabase.co
SUPABASE_ANON_KEY=sua_anon_key_aqui
```

---

## 💻 3. Comandos de Execução e Build

### Modo de Desenvolvimento (Dev)
Inicia o servidor Express integrado ao Vite Middleware com suporte a TypeScript nativo:
```bash
npm run dev
```
O aplicativo estará acessível em `http://localhost:3000`.

### Compilação de Produção (Build)
Compila o frontend (Vite SPA) e empacota o backend (`server.ts`) em um bundle CommonJS standalone (`dist/server.cjs`):
```bash
npm run build
```

### Iniciar em Produção (Start)
Executa o servidor compilado de alta performance:
```bash
npm run start
```

---

## 🔐 4. Migração de Autenticação para Produção (Supabase / JWT)

O HUB-SIM v3.5 possui arquitetura preparada para **Role-Based Access Control (RBAC)** no frontend e backend.

### A. Estrutura de Usuários do Board no Frontend
Os usuários padrão configurados para o Board Executivo são:
- **CFO & Controller**: `cfo@hubfitness.com.br` | Senha: `hub2026` (Acesso Total)
- **Sócio / Investidor**: `socio@hubfitness.com.br` | Senha: `hub2026` (Acesso Estratégico)
- **Comitê de Risco**: `comite@hubfitness.com.br` | Senha: `hub2026` (Modo Leitura + Trava 🔒)
- **VP Comercial**: `comercial@hubfitness.com.br` | Senha: `hub2026` (Pitch Mode / Sem M2 e M4)

### B. Ativando o Middleware JWT no `server.ts`
No arquivo `server.ts`, descomente a seção do middleware `verifyTokenMiddleware` e aplique nas rotas protegidas da API:

```typescript
import jwt from "jsonwebtoken";

const verifyTokenMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Acesso negado. Token ausente." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "hub-sim-secret-v35");
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: "Token inválido." });
  }
};

// Exemplo de aplicação em rotas críticas:
app.post("/api/gemini/advisor", verifyTokenMiddleware, async (req, res) => { ... });
```

---

## ☁️ 5. Opções de Deploy em Nuvem

### Opção A: Google Cloud Run (Recomendado)
1. Crie o container Docker com a imagem Node.js 20.
2. Defina as variáveis `GEMINI_API_KEY` e `PORT=3000` no Secret Manager.
3. Mapeie a porta de entrada para `3000`.

### Opção B: Docker VPS / Render / Railway
Crie um `Dockerfile` simples:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🔒 6. Matriz de Permissões RBAC (Conformidade Executiva)

| Módulo | CFO / Controller | Sócio / Board | Comitê de Risco | Comercial / Vendas |
|---|:---:|:---:|:---:|:---:|
| **M1: Dashboard Executivo** | ✅ | ✅ | ✅ | ✅ |
| **M2: DRE Granular 24m** | ✅ | ✅ | 🔒 Leitura | ❌ Invisível / Negado |
| **M3: Receita VAS** | ✅ | ✅ | 🔒 Leitura | ✅ |
| **M4: Fluxo de Caixa** | ✅ | ✅ | 🔒 Leitura | ❌ Invisível / Negado |
| **M5: Fator R & Tributos** | ✅ | ✅ | 🔒 Leitura | 🔒 Leitura |
| **M10 - M15 (CPQ, CRM, RH)** | ✅ | ✅ | 🔒 Leitura | ✅ |

---

*HUB-SIM 3PL Logistics Planner v3.5 — Todos os direitos reservados.*
