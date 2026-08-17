import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { buildSystemPrompt } from "./src/core/advisor/prompt";
import { buildAdvisorContext } from "./src/core/advisor/context";
import { bootstrapComexStore, registerPucomexRoutes } from "./src/core/comex/registerPucomexRoutes";
import { pucomexClient } from "./src/core/comex/pucomexClient";
import { registerIntranetRoutes } from "./src/core/intranet/registerIntranetRoutes";
import { registerApproveRoutes } from "./src/core/intranet/registerApproveRoutes";
import { registerOperatorRoutes } from "./src/core/operator/registerOperatorRoutes";
import { getIntranetStore } from "./src/core/intranet/intranetStore";
import { startOutboxDispatcher } from "./src/core/intranet/outboxDispatcher";
import { accountByCode, buildCoaResearchPrompt } from "./src/core/compras/researchFromCoa";
import { finalizeComprasResearchPack, pickComprasResearchFallback } from "./src/core/compras/comprasResearchPack";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const VITE_HMR_PORT = Number(process.env.VITE_HMR_PORT || 24678);

app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/comex/documents/ingest") {
    return next();
  }
  if (req.method === "POST" && req.path.startsWith("/approve/")) {
    return express.urlencoded({ extended: true })(req, res, (err) => {
      if (err) return next(err);
      return express.json({ limit: "1mb" })(req, res, next);
    });
  }
  return express.json({ limit: "5mb" })(req, res, next);
});

// Initialize Google GenAI SDK (Server-Side Only)
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", geminiEnabled: !!apiKey });
});

// =========================================================
// MIDDLEWARE DE AUTENTICAÇÃO E VERIFICAÇÃO DE TOKEN (JWT / SUPABASE)
// =========================================================
// Estrutura pronta para produção: Ative ao conectar o Supabase Auth ou JWT Secret.
/*
import jwt from "jsonwebtoken";

const verifyTokenMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Acesso negado. Token de autorização ausente." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "hub-sim-secret-v35");
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: "Token de sessão inválido ou expirado." });
  }
};
*/

// BANCO MOCKADO DE MEMBROS DO BOARD EXEC
const MOCK_BOARD_USERS: Record<string, { id: string; name: string; email: string; role: string; title: string; pass: string }> = {
  "cfo@hubfitness.com.br": {
    id: "u-cfo",
    name: "Dr. Roberto Mendes",
    email: "cfo@hubfitness.com.br",
    role: "cfo",
    title: "CFO / Controller Sênior",
    pass: "hub2026",
  },
  "socio@hubfitness.com.br": {
    id: "u-socio",
    name: "Carlos Eduardo",
    email: "socio@hubfitness.com.br",
    role: "socio",
    title: "Sócio-Fundador / Board",
    pass: "hub2026",
  },
  "comite@hubfitness.com.br": {
    id: "u-comite",
    name: "Juliana Paes",
    email: "comite@hubfitness.com.br",
    role: "comite",
    title: "Comitê de Risco & Auditoria",
    pass: "hub2026",
  },
  "comercial@hubfitness.com.br": {
    id: "u-comercial",
    name: "Fernando Silva",
    email: "comercial@hubfitness.com.br",
    role: "comercial",
    title: "VP de Negócios & Vendas",
    pass: "hub2026",
  },
  "compras@hubfitness.com.br": {
    id: "u-compras",
    name: "Ana Souza",
    email: "compras@hubfitness.com.br",
    role: "compras",
    title: "Assistente de Compras",
    pass: "hub2026",
  },
};

// ROTA DE LOGIN (/api/auth/login)
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios." });
  }

  const lowerEmail = String(email).toLowerCase().trim();
  const mockUser = MOCK_BOARD_USERS[lowerEmail];

  if (mockUser && mockUser.pass === password) {
    const { pass, ...userProfile } = mockUser;
    return res.json({
      success: true,
      token: `mock-jwt:${userProfile.email}`,
      user: userProfile,
    });
  }

  return res.status(401).json({
    success: false,
    error: "Credenciais inválidas. Verifique o e-mail e senha informados.",
  });
});

function resolveSessionEmail(req: { headers: Record<string, unknown> }): string | null {
  const headerEmail = String(req.headers["x-user-email"] || "")
    .toLowerCase()
    .trim();
  if (headerEmail && MOCK_BOARD_USERS[headerEmail]) return headerEmail;

  const authHeader = String(req.headers["authorization"] || "");
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const emailMatch = token.match(/^mock-jwt:(.+)$/i);
  if (emailMatch) {
    const email = emailMatch[1].toLowerCase().trim();
    if (MOCK_BOARD_USERS[email]) return email;
  }

  const roleMatch = token.match(/^mock-jwt-(\w+)-v35$/i);
  if (roleMatch) {
    const role = roleMatch[1].toLowerCase();
    const found = Object.values(MOCK_BOARD_USERS).find((u) => u.role === role);
    if (found) return found.email;
  }

  return null;
}

// ROTA DE USUÁRIO ATUAL (/api/auth/me) — espelha sessão (e-mail), não CFO fixo
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader && !req.headers["x-user-email"]) {
    return res.status(401).json({ success: false, error: "Não autenticado." });
  }

  const email = resolveSessionEmail(req as { headers: Record<string, unknown> });
  if (!email) {
    return res.status(401).json({ success: false, error: "Sessão inválida ou e-mail não reconhecido." });
  }

  const mockUser = MOCK_BOARD_USERS[email];
  const { pass, ...userProfile } = mockUser;

  return res.json({
    success: true,
    user: userProfile,
  });
});

// Gemini CFO Advisor Endpoint
app.post("/api/gemini/advisor", async (req, res) => {
  try {
    const { module, scenarioName, prompt, contextData, plannerPayload } = req.body;

    const context =
      contextData ??
      (plannerPayload ? buildAdvisorContext(plannerPayload) : buildAdvisorContext({ module, scenarioName, prompt }));

    if (!ai) {
      const kpis = context.kpis ?? {};
      return res.json({
        success: true,
        isSimulated: true,
        analysis: `[Modo offline — sem API Key Gemini]

Use os KPIs computados do contexto (não narrativa hardcoded):
- Receita 24m: R$ ${Number(kpis.receitaTotal24m ?? 0).toLocaleString("pt-BR")}
- Lucro 24m: R$ ${Number(kpis.lucroLiquido24m ?? 0).toLocaleString("pt-BR")}
- Spine CLIA M12: R$ ${Number(kpis.cliaSpineM12 ?? 0).toLocaleString("pt-BR")}
- Spine CLIA M24: R$ ${Number(kpis.cliaSpineM24 ?? 0).toLocaleString("pt-BR")}
- Saldo M24 (Carência Aluguel): R$ ${Number(kpis.saldoM24CarenciaAluguel ?? 0).toLocaleString("pt-BR")}
- Homologado vs BP: ${context.deltasVsOfficial?.homologado ? "SIM" : "NÃO"}

Configure GEMINI_API_KEY para análise qualitativa completa.`,
        context,
      });
    }

    const systemInstruction = buildSystemPrompt();

    const userPrompt = `Módulo: ${module || "Geral"}
Cenário: ${scenarioName || "Realista v3.6 (Oficial)"}
Foco: ${prompt || "Análise executiva de riscos e conformidade."}
Contexto do Sistema: ${JSON.stringify(context, null, 2)}`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    return res.json({
      success: true,
      isSimulated: false,
      analysis: response.text,
    });
  } catch (error: any) {
    console.error("Erro na API do Gemini:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Erro interno ao processar requisição na API Gemini.",
    });
  }
});

// =========================================================
// COMEX / PUCOMEX — cliente mTLS oficial + CRM processos
// Docs: https://docs.portalunico.siscomex.gov.br/
// =========================================================
registerPucomexRoutes(app);
registerIntranetRoutes(app);
registerApproveRoutes(app);
registerOperatorRoutes(app);

app.post("/api/gemini/comex-ai", async (req, res) => {
  const {
    ncmCode = "9506.91.00",
    productDescription = "Fitness equipment",
    operationType = "importacao",
    fobValueUsd = 50000,
    country = "China (CN)",
  } = req.body ?? {};

  // Enriquece com consulta NCM no Portal quando sessão/live disponível
  let portalNcm: unknown = null;
  try {
    const ncmRes = await pucomexClient.consultNcm(String(ncmCode));
    portalNcm = ncmRes.data;
  } catch {
    portalNcm = null;
  }

  const hasPortal = portalNcm != null;
  // Sem Portal: não inventar alíquotas como se fossem do Siscomex
  const fallback = {
    productCategory: `Aparelhos de ginástica / NCM ${ncmCode}`,
    siscomexChannelRisk: hasPortal ? "Verde" : "Indeterminado",
    auditSummary: hasPortal
      ? `Parecer HUB-FITNESS: ${operationType} de "${productDescription}" (NCM ${ncmCode}) com origem/destino ${country}, FOB USD ${Number(fobValueUsd).toLocaleString("pt-BR")}. Densidade/CIF alimentam pitch e CLIA; Ad Valorem do DRE permanece 0,10% sobre NF de serviço.`
      : `Portal Único indisponível para NCM ${ncmCode}. Alíquotas II/IPI/PIS/COFINS não foram inventadas — use consulta live PUCOMEX ou tax_rates no Operator. Ad Valorem do DRE permanece 0,10% sobre NF de serviço.`,
    estimatedTaxes: null as null | Record<string, number>,
    taxesSource: hasPortal ? "portal" : "unavailable",
    lpcoRequirements: ["Verificar MAPA/INMETRO caso a caso (sem Portal não há isenção assumida)"],
    requiredDocuments: ["Invoice comercial", "Packing list", "BL / conhecimento de embarque", "DI/DUIMP"],
    portalNcm,
    portalMode: pucomexClient.getStatus().liveModeEnabled ? "live-capable" : "demo",
  };

  if (!ai) {
    return res.json({ success: true, isSimulated: true, data: fallback });
  }

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: `Você é auditor Comex BR para 3PL fitness. Responda APENAS JSON válido com campos: productCategory, siscomexChannelRisk, auditSummary, estimatedTaxes (objeto ou null), lpcoRequirements[], requiredDocuments[], taxesSource ("portal"|"unavailable").
Regra: se Dados Portal for null/ausente, estimatedTaxes DEVE ser null, taxesSource="unavailable", siscomexChannelRisk="Indeterminado". NÃO invente alíquotas II/PIS/COFINS como se fossem do Portal.
NCM: ${ncmCode}
Produto: ${productDescription}
Operação: ${operationType}
FOB USD: ${fobValueUsd}
País: ${country}
Dados Portal (se houver): ${JSON.stringify(portalNcm)?.slice(0, 2000)}`,
      config: { temperature: 0.3 },
    });
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ success: true, isSimulated: false, data: fallback });
    }
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (!hasPortal) {
      parsed.estimatedTaxes = null;
      parsed.taxesSource = "unavailable";
      if (!parsed.siscomexChannelRisk || parsed.siscomexChannelRisk === "Verde") {
        parsed.siscomexChannelRisk = "Indeterminado";
      }
    }
    const data = { ...parsed, portalNcm, taxesSource: hasPortal ? (parsed.taxesSource || "portal") : "unavailable" };
    return res.json({ success: true, isSimulated: false, data });
  } catch (error: any) {
    return res.json({ success: true, isSimulated: true, data: fallback, warning: error.message });
  }
});

/** Pesquisa de insumos AG a partir do Plano de Contas — dentro da UI (mesmo padrão Comex/Advisor). */
app.post("/api/gemini/compras-research", async (req, res) => {
  const accountCode = String(req.body?.accountCode || "5.1.01");
  const amplifyNote =
    typeof req.body?.amplifyNote === "string" && req.body.amplifyNote.trim()
      ? String(req.body.amplifyNote)
      : undefined;
  const account = accountByCode(accountCode);
  if (!account) {
    return res.status(400).json({ success: false, error: `Conta ${accountCode} não encontrada no Plano.` });
  }

  const prompt = buildCoaResearchPrompt({ account, amplifyNote });
  const pickFallback = () => pickComprasResearchFallback(accountCode, amplifyNote);

  if (!ai) {
    return res.json({
      success: true,
      isSimulated: true,
      pack: pickFallback(),
      prompt,
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: `${prompt}

Responda APENAS com JSON válido (sem markdown), domain "compras".
Prefira o schema canônico:
{ "domain":"compras", "items":[{ "category":"Fitas & Cantoneiras", "item_name":"...", "sku_spec":"...", "monthly_volume_hypothesis":{"qty":1,"historical_data":false,"status":"sem_dados_historicos"}, "suppliers":[{ "trade_name":"...", "uf":"SC", "city":"...", "unit_price_brl":0, "freight_type_quoted":"FOB", "shipping_cost_monthly_brl_to_itajai":0, "lead_time_days_to_itajai":3, "icms_rate_pct":12 }] }] }
Se usar quotes[] alternativo, inclua supplier_name, origin_city_state ("Cidade / UF"), unit_price_brl, freight_type, freight_cost_brl.
REGRA DURA: exatamente 1 item e exatamente 3 suppliers/quotes no total.`,
      config: { temperature: 0.35 },
    });
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({
        success: true,
        isSimulated: true,
        pack: pickFallback(),
        prompt,
        warning: "Modelo não retornou JSON — usando fallback.",
        raw: text.slice(0, 4000),
      });
    }
    const rawPack = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const pack = finalizeComprasResearchPack(accountCode, rawPack);
    return res.json({ success: true, isSimulated: false, pack, prompt });
  } catch (error: any) {
    return res.json({
      success: true,
      isSimulated: true,
      pack: pickFallback(),
      prompt,
      warning: error.message || "Falha Gemini — fallback.",
    });
  }
});

// BLOQUEIO ESTRITO DE ROTAS API (Evita o erro <!doctype html>)
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, error: `Rota API não encontrada: ${_req.method} ${_req.originalUrl}` });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: VITE_HMR_PORT },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    await bootstrapComexStore();
  } catch (err) {
    console.warn(
      `📁 Comex bootstrap ignorado — servidor sobe mesmo assim. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    const px = pucomexClient.getStatus();
    console.log(`🚀 Server HUB-SIM rodando em http://localhost:${PORT}`);
    console.log(
      `🌐 PUCOMEX: env=${px.environment} live=${px.liveModeEnabled} role=${px.roleType} base=${px.baseUrl}`,
    );
    startOutboxDispatcher(getIntranetStore());
  });

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `❌ Porta ${PORT} ainda ocupada (EADDRINUSE). Rode: npm run free:ports && npm run dev`,
      );
      process.exit(1);
    }
    console.error("Erro no servidor HTTP:", err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error("Falha crítica ao iniciar o servidor:", err);
  process.exit(1);
});
