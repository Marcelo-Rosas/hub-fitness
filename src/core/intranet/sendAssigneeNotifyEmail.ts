import type { SupplierEmailResult } from './sendSupplierEmail';
import { isIntranetEmailLive } from './sendSupplierEmail';

export interface AssigneeNotifyInput {
  to: string;
  assigneeName: string;
  code: string;
  title: string;
  item: string;
  volume: string;
  approveUrl: string;
  supplierName?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBodies(input: AssigneeNotifyInput): { subject: string; text: string; html: string } {
  const subject = `[HUB] RFQ ${input.code} aguarda sua alçada`;
  const text = [
    `Olá ${input.assigneeName},`,
    '',
    `A requisição ${input.code} (${input.title}) aguarda sua decisão.`,
    `Item: ${input.item}`,
    `Volume: ${input.volume}`,
    input.supplierName ? `Fornecedor: ${input.supplierName}` : '',
    '',
    `Abrir alçada: ${input.approveUrl}`,
    '',
    'O link expira em 48h e só pode ser usado uma vez.',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const html = `<p>Olá <strong>${escapeHtml(input.assigneeName)}</strong>,</p>
<p>A requisição <strong>${escapeHtml(input.code)}</strong> (${escapeHtml(input.title)}) aguarda sua alçada.</p>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
<tr><td style="padding:4px 8px;color:#64748b">Item</td><td>${escapeHtml(input.item)}</td></tr>
<tr><td style="padding:4px 8px;color:#64748b">Volume</td><td>${escapeHtml(input.volume)}</td></tr>
${
  input.supplierName
    ? `<tr><td style="padding:4px 8px;color:#64748b">Fornecedor</td><td>${escapeHtml(input.supplierName)}</td></tr>`
    : ''
}
</table>
<p style="margin:20px 0">
  <a href="${escapeHtml(input.approveUrl)}"
     style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">
    Abrir alçada
  </a>
</p>
<p style="color:#64748b;font-size:12px">Link único · expira em 48h · não encaminhe.</p>`;

  return { subject, text, html };
}

export async function sendAssigneeNotifyEmail(
  input: AssigneeNotifyInput,
): Promise<SupplierEmailResult> {
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
