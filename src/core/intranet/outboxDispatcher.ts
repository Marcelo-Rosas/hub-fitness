import type { SqliteIntranetStore } from './intranetStore';
import { sendSupplierRfqEmail, type SupplierEmailResult } from './sendSupplierEmail';

type SendFn = (input: {
  to: string;
  supplierName: string;
  code: string;
  item: string;
  volume: string;
  state: string;
  payment: string;
  notes?: string;
}) => Promise<SupplierEmailResult>;

export async function dispatchOutboxOnce(
  store: SqliteIntranetStore,
  send: SendFn = sendSupplierRfqEmail,
): Promise<boolean> {
  const event = store.claimPendingOutbox();
  if (!event) return false;
  if (event.event_type !== 'WORKFLOW.APPROVED') {
    store.finishOutbox(event.id, true);
    return true;
  }
  const p = event.payload;
  const result = await send({
    to: String(p.to || ''),
    supplierName: String(p.supplierName || 'Fornecedor'),
    code: String(p.code || ''),
    item: String(p.item || ''),
    volume: String(p.volume || ''),
    state: String(p.state || ''),
    payment: String(p.payment || ''),
    notes: p.notes ? String(p.notes) : undefined,
  });
  if (!result.ok) {
    store.finishOutbox(event.id, false, result.error);
    if (event.request_id) store.setRequestEmail(event.request_id, 'failed', result.error || 'Falha no envio');
    return true;
  }
  store.finishOutbox(event.id, true);
  if (event.request_id) {
    store.setRequestEmail(event.request_id, result.mode === 'resend' ? 'sent' : 'simulated', null);
  }
  return true;
}

export function startOutboxDispatcher(store: SqliteIntranetStore, intervalMs = 3000): () => void {
  const timer = setInterval(() => {
    void dispatchOutboxOnce(store).catch((err) => {
      console.error('[intranet outbox]', err);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
