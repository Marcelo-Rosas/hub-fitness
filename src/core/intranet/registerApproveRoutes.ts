import type { Express, Request, Response } from 'express';
import { executeStepDecision } from './approvalService';
import { lookupApprovalToken } from './approvalTokens';
import { dossierGaps } from './dossierGaps';
import { getIntranetStore } from './intranetStore';
import type { DecisionAction } from '../../types/intranet';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateHits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0]!.trim();
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(req: Request): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const cur = rateHits.get(ip);
  if (!cur || now >= cur.resetAt) {
    rateHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyBrl(v: unknown): string | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function layout(title: string, body: string, status = 200): { status: number; html: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)} · HUB-FITNESS</title>
  <style>
    :root { --bg:#f1f5f9; --card:#fff; --ink:#0f172a; --muted:#64748b; --teal:#0f766e; --amber:#b45309; --rose:#be123c; --line:#e2e8f0; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; background: linear-gradient(165deg,#ecfdf5 0%,#f1f5f9 45%,#e2e8f0 100%); color:var(--ink); min-height:100vh; }
    .wrap { max-width:560px; margin:0 auto; padding:24px 16px 48px; }
    .brand { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--teal); font-weight:700; margin-bottom:8px; }
    h1 { font-size:1.35rem; margin:0 0 4px; line-height:1.25; }
    .sub { color:var(--muted); font-size:14px; margin:0 0 20px; }
    .panel { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; box-shadow:0 8px 24px rgba(15,23,42,.06); }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; font-size:13px; }
    .lbl { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; font-weight:700; }
    .val { font-weight:600; word-break:break-word; }
    .banner { margin-top:12px; font-size:12px; color:#78350f; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; }
    .actions { display:flex; flex-direction:column; gap:10px; margin-top:18px; }
    button { appearance:none; border:none; border-radius:8px; padding:12px 14px; font-size:15px; font-weight:700; cursor:pointer; }
    .btn-approve { background:var(--teal); color:#fff; }
    .btn-changes { background:#fef3c7; color:#92400e; }
    .btn-reject { background:#ffe4e6; color:var(--rose); }
    label { display:block; font-size:12px; font-weight:600; color:var(--muted); margin:14px 0 6px; }
    textarea { width:100%; min-height:72px; border:1px solid var(--line); border-radius:8px; padding:10px; font:inherit; resize:vertical; }
    .msg { padding:16px; border-radius:10px; background:#fff; border:1px solid var(--line); }
    .msg.err { border-color:#fecdd3; background:#fff1f2; color:#9f1239; }
    .msg.ok { border-color:#a7f3d0; background:#ecfdf5; color:#065f46; }
    @media (max-width:420px) { .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">HUB-FITNESS · Alçada</div>
    ${body}
  </div>
</body>
</html>`;
  return { status, html };
}

function briefRows(payload: Record<string, unknown>): string {
  const unit = moneyBrl(payload.unit_price);
  const freight = moneyBrl(payload.freight_monthly);
  const landed = moneyBrl(payload.landed_monthly);
  const leadRaw = payload.lead_time_days ?? payload.delivery_lead_time_days;
  const lead =
    leadRaw != null && Number.isFinite(Number(leadRaw)) && Number(leadRaw) > 0
      ? `${Number(leadRaw)} dia(s)`
      : '—';
  const scoreLabel =
    payload.score_label != null
      ? String(payload.score_label)
      : payload.score != null && Number.isFinite(Number(payload.score))
        ? `heurística ${Number(payload.score)}/100`
        : '—';
  const rows: Array<[string, string]> = [
    ['Conta CoA', payload.account_code != null ? String(payload.account_code) : '—'],
    ['Categoria', payload.category != null ? String(payload.category) : '—'],
    ['Volume', payload.volume != null ? String(payload.volume) : '—'],
    ['Pagamento', payload.payment != null ? String(payload.payment) : '—'],
    ['Preço unitário', unit || '—'],
    ['Frete / mês', freight || '—'],
    ['Landed / mês', landed || '—'],
    ['Prazo → hub SC', lead],
    [
      'Destino',
      payload.state_label != null
        ? String(payload.state_label)
        : payload.warehouse_code != null
          ? String(payload.warehouse_code)
          : '—',
    ],
    ['Score (heurística)', scoreLabel],
    ['Tipo preço', payload.price_type != null ? String(payload.price_type) : '—'],
  ];
  return rows
    .map(
      ([l, v]) =>
        `<div><div class="lbl">${escapeHtml(l)}</div><div class="val">${escapeHtml(v)}</div></div>`,
    )
    .join('');
}

function decideForm(token: string, version: number, errorMsg?: string): string {
  const err = errorMsg
    ? `<div class="msg err" style="margin-bottom:12px">${escapeHtml(errorMsg)}</div>`
    : '';
  return `${err}
<form method="POST" action="/approve/${encodeURIComponent(token)}" class="actions">
  <input type="hidden" name="expectedVersion" value="${version}"/>
  <label for="reason">Motivo (obrigatório em correção / rejeição)</label>
  <textarea id="reason" name="reason" placeholder="Descreva o motivo…"></textarea>
  <button type="submit" name="action" value="APPROVE" class="btn-approve">Aprovar</button>
  <button type="submit" name="action" value="REQUEST_CHANGES" class="btn-changes">Pedir correção</button>
  <button type="submit" name="action" value="REJECT" class="btn-reject">Rejeitar</button>
</form>`;
}

function parseAction(raw: unknown): DecisionAction | null {
  const a = String(raw || '').toUpperCase();
  if (a === 'APPROVE' || a === 'REJECT' || a === 'REQUEST_CHANGES') return a;
  return null;
}

export function registerApproveRoutes(app: Express): void {
  app.get('/approve/:token', (req, res) => {
    const raw = String(req.params.token || '');
    const store = getIntranetStore();
    const looked = lookupApprovalToken(store, raw);
    if (looked.ok === false) {
      if (looked.reason === 'NOT_FOUND') {
        const page = layout('Link inválido', `<div class="msg err">Link de aprovação inválido.</div>`, 404);
        return res.status(page.status).type('html').send(page.html);
      }
      if (looked.reason === 'EXPIRED') {
        const page = layout('Link expirado', `<div class="msg err">Este link expirou (validade 48h).</div>`, 410);
        return res.status(page.status).type('html').send(page.html);
      }
      const page = layout(
        'Já utilizado',
        `<div class="msg err">Este link já foi usado. Abra a fila M19 se precisar acompanhar o status.</div>`,
        409,
      );
      return res.status(page.status).type('html').send(page.html);
    }

    const token = looked.token;
    const request = store.getRequest(token.request_id);
    if (!request) {
      const page = layout('Não encontrada', `<div class="msg err">Requisição não encontrada.</div>`, 404);
      return res.status(page.status).type('html').send(page.html);
    }

    if (request.status !== 'IN_REVIEW') {
      const page = layout(
        'Já decidido',
        `<div class="msg">Esta RFQ já está em status <strong>${escapeHtml(request.status)}</strong>. Decisão via M19 ou link anterior.</div>`,
        409,
      );
      return res.status(page.status).type('html').send(page.html);
    }

    const opsFlags = store.getOpsRealFlags();
    const gaps = dossierGaps(request.payload, opsFlags);
    const banner =
      gaps.length > 0
        ? `<div class="banner">Dossiê incompleto para alçada: falta ${escapeHtml(gaps.join(', '))}. Preferir <strong>Pedir correção</strong> em vez de aprovar às cegas.</div>`
        : '';

    const body = `
      <h1>${escapeHtml(request.code)}</h1>
      <p class="sub">${escapeHtml(request.title)}${request.supplier_name ? ` · ${escapeHtml(request.supplier_name)}` : ''}</p>
      <div class="panel">
        <div class="grid">${briefRows(request.payload)}</div>
        ${banner}
        ${decideForm(raw, request.version)}
      </div>`;
    const page = layout(request.code, body, 200);
    return res.status(page.status).type('html').send(page.html);
  });

  app.post('/approve/:token', async (req, res) => {
    if (!checkRateLimit(req)) {
      const page = layout('Limite', `<div class="msg err">Muitas tentativas. Aguarde um minuto.</div>`, 429);
      return res.status(page.status).type('html').send(page.html);
    }

    const raw = String(req.params.token || '');
    const store = getIntranetStore();
    const looked = lookupApprovalToken(store, raw);

    const respondError = (status: number, title: string, msg: string) => {
      const page = layout(title, `<div class="msg err">${escapeHtml(msg)}</div>`, status);
      return res.status(page.status).type('html').send(page.html);
    };

    if (looked.ok === false) {
      if (looked.reason === 'EXPIRED') return respondError(410, 'Expirado', 'Este link expirou (validade 48h).');
      if (looked.reason === 'USED') return respondError(409, 'Já usado', 'Este link já foi usado.');
      return respondError(404, 'Inválido', 'Link de aprovação inválido.');
    }

    const token = looked.token;
    const request = store.getRequest(token.request_id);
    if (!request) return respondError(404, 'Não encontrada', 'Requisição não encontrada.');
    if (request.status !== 'IN_REVIEW') {
      return respondError(409, 'Já decidido', `RFQ já em status ${request.status}.`);
    }

    const body = req.body ?? {};
    const action = parseAction(body.action);
    if (!action) return respondError(400, 'Ação', 'Ação inválida.');

    const reason = String(body.reason || '');
    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isFinite(expectedVersion)) {
      return respondError(400, 'Versão', 'expectedVersion inválido.');
    }

    const assignee = store.getEmployee(token.assignee_employee_id);
    if (!assignee?.email) return respondError(403, 'Sem permissão', 'Assignee do token inválido.');

    if (request.assigned_employee_id && request.assigned_employee_id !== token.assignee_employee_id) {
      return respondError(403, 'Sem permissão', 'Token não corresponde à assignment ativa.');
    }

    const result = await executeStepDecision(store, {
      requestId: request.id,
      actorEmail: assignee.email,
      action,
      reason,
      expectedVersion,
      channel: 'email_token',
    });

    if ('error' in result) {
      const map: Record<string, { status: number; title: string; msg: string }> = {
        VERSION_CONFLICT: {
          status: 409,
          title: 'Conflito',
          msg: 'Versão desatualizada — atualize a página e tente de novo.',
        },
        MOTIVO_OBRIGATORIO: { status: 400, title: 'Motivo', msg: 'Informe o motivo para correção ou rejeição.' },
        PRECO_INCOMPLETO: {
          status: 400,
          title: 'Preço incompleto',
          msg: 'Aprovação bloqueada: falta preço unitário e/ou landed. Preferir Pedir correção.',
        },
        ACTOR_NAO_ASSIGNED: { status: 403, title: 'Sem permissão', msg: 'Você não é o assignee ativo desta RFQ.' },
        SEM_PERMISSAO: { status: 403, title: 'Sem permissão', msg: 'Sem permissão.' },
      };
      const known = map[result.error];
      if (known) return respondError(known.status, known.title, known.msg);

      // Re-render form with error for soft failures
      const opsFlags = store.getOpsRealFlags();
      const gaps = dossierGaps(request.payload, opsFlags);
      const banner =
        gaps.length > 0
          ? `<div class="banner">Dossiê incompleto para alçada: falta ${escapeHtml(gaps.join(', '))}.</div>`
          : '';
      const page = layout(
        request.code,
        `<h1>${escapeHtml(request.code)}</h1>
         <div class="panel">
           <div class="grid">${briefRows(request.payload)}</div>
           ${banner}
           ${decideForm(raw, request.version, result.error)}
         </div>`,
        400,
      );
      return res.status(page.status).type('html').send(page.html);
    }

    store.markApprovalTokenUsed(token.id);

    const label =
      action === 'APPROVE' ? 'aprovada' : action === 'REJECT' ? 'rejeitada' : 'enviada para correção';
    const page = layout(
      'Decisão registrada',
      `<div class="msg ok">
        <strong>${escapeHtml(result.request.code)}</strong> foi ${label}.
        Status atual: <strong>${escapeHtml(result.request.status)}</strong>.
      </div>`,
      200,
    );
    return res.status(page.status).type('html').send(page.html);
  });
}

/** Test helper — clear in-memory rate map. */
export function resetApproveRateLimitForTests(): void {
  rateHits.clear();
}
