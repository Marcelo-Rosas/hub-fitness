export interface SupplierEmailInput {
  to: string;
  supplierName: string;
  code: string;
  item: string;
  volume: string;
  state: string;
  payment: string;
  notes?: string;
}

export interface SupplierEmailResult {
  ok: boolean;
  mode: 'resend' | 'simulated';
  id?: string;
  error?: string;
}

function buildBodies(input: SupplierEmailInput): { subject: string; text: string; html: string } {
  const subject = `HUB-FITNESS · Solicitação de cotação ${input.code}`;
  const text = [
    `Prezado(a) ${input.supplierName},`,
    '',
    `A HUB-FITNESS 3PL Logistics S.A. solicita cotação formal:`,
    `Requisição: ${input.code}`,
    `Item: ${input.item}`,
    `Volume: ${input.volume}`,
    `Destino: ${input.state}`,
    `Pagamento alvo: ${input.payment}`,
    input.notes ? `Obs.: ${input.notes}` : '',
    '',
    'Favor responder para compras@hubfitness3pl.com.br.',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const html = `<p>Prezado(a) <strong>${escapeHtml(input.supplierName)}</strong>,</p>
<p>A <strong>HUB-FITNESS 3PL Logistics S.A.</strong> solicita cotação formal após aprovação interna.</p>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
<tr><td style="padding:4px 8px;color:#64748b">Requisição</td><td>${escapeHtml(input.code)}</td></tr>
<tr><td style="padding:4px 8px;color:#64748b">Item</td><td>${escapeHtml(input.item)}</td></tr>
<tr><td style="padding:4px 8px;color:#64748b">Volume</td><td>${escapeHtml(input.volume)}</td></tr>
<tr><td style="padding:4px 8px;color:#64748b">Destino</td><td>${escapeHtml(input.state)}</td></tr>
<tr><td style="padding:4px 8px;color:#64748b">Pagamento</td><td>${escapeHtml(input.payment)}</td></tr>
</table>
<p>Favor enviar a proposta comercial para <a href="mailto:compras@hubfitness3pl.com.br">compras@hubfitness3pl.com.br</a>.</p>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isIntranetEmailLive(): boolean {
  return process.env.INTRANET_EMAIL_LIVE === 'true' && Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendSupplierRfqEmail(input: SupplierEmailInput): Promise<SupplierEmailResult> {
  const { subject, text, html } = buildBodies(input);
  if (!isIntranetEmailLive()) {
    return { ok: true, mode: 'simulated' };
  }

  const from =
    process.env.RESEND_FROM?.trim() || 'HUB-FITNESS Compras <compras@hubfitness3pl.com.br>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        html,
        text,
      }),
    });
    const json = (await res.json()) as { id?: string; message?: string; error?: { message?: string } };
    if (!res.ok) {
      return {
        ok: false,
        mode: 'resend',
        error: json.error?.message || json.message || `HTTP ${res.status}`,
      };
    }
    return { ok: true, mode: 'resend', id: json.id };
  } catch (err) {
    return {
      ok: false,
      mode: 'resend',
      error: err instanceof Error ? err.message : 'Falha ao enviar e-mail',
    };
  }
}
