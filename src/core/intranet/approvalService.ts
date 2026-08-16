import { canTransition, nextStatus } from './fsm';
import { missingCommercialForApprove } from './dossierGaps';
import { mintApprovalToken } from './approvalTokens';
import { effectivePerms, resolveApprover } from './orgResolver';
import { upsertQuote, upsertSupplier } from './quoteLedger';
import type { SqliteIntranetStore } from './intranetStore';
import type { DecisionAction, IntranetRequestRecord } from '../../types/intranet';

function enqueueAssignmentNotify(
  store: SqliteIntranetStore,
  input: {
    request: IntranetRequestRecord;
    assignmentId: string;
    assigneeEmployeeId: string;
  },
): void {
  const assignee = store.getEmployee(input.assigneeEmployeeId);
  const minted = mintApprovalToken(store, {
    request_id: input.request.id,
    assignment_id: input.assignmentId,
    assignee_employee_id: input.assigneeEmployeeId,
  });
  store.insertOutbox({
    request_id: input.request.id,
    event_type: 'ASSIGNMENT.NOTIFY',
    payload: {
      to: assignee?.email || '',
      assigneeName: assignee?.full_name || 'Aprovador',
      code: input.request.code,
      title: input.request.title,
      item: String(input.request.payload.item || input.request.title),
      volume: String(input.request.payload.volume || ''),
      supplierName: input.request.supplier_name || undefined,
      approveUrl: minted.approveUrl,
      // raw only in outbox payload for simulated/debug — never listed in GET inbox
      _debugApprovePath: `/approve/${minted.rawToken}`,
    },
  });
}

function ensureQuoteIdOnPayload(
  store: SqliteIntranetStore,
  input: {
    title: string;
    payload: Record<string, unknown>;
    supplier_name?: string | null;
    supplier_email?: string | null;
  },
): Record<string, unknown> {
  const payload = { ...input.payload };
  if (payload.quote_id) return payload;

  const unit = Number(payload.unit_price ?? payload.unit_price_brl ?? 0);
  const freight = Number(payload.freight_monthly ?? payload.freight_monthly_brl ?? 0);
  const landed = Number(payload.landed_monthly ?? payload.landed_cost_monthly_brl ?? 0);
  const supplier = upsertSupplier(store, {
    trade_name: String(input.supplier_name || 'Fornecedor'),
    email: String(input.supplier_email || ''),
    uf: String(payload.supplier_state || payload.state || ''),
    source: 'rfq',
  });
  const q = upsertQuote(store, {
    supplier_id: supplier.id,
    account_code: String(payload.account_code || ''),
    category: String(payload.category || ''),
    item_description: String(payload.item || payload.product_description || input.title),
    unit_price_brl: Number.isFinite(unit) ? unit : 0,
    freight_monthly_brl: Number.isFinite(freight) ? freight : 0,
    landed_monthly_brl: Number.isFinite(landed) ? landed : 0,
    volume_label: String(payload.volume || ''),
    lead_time_days:
      payload.lead_time_days != null && Number.isFinite(Number(payload.lead_time_days))
        ? Number(payload.lead_time_days)
        : undefined,
    payment_terms: String(payload.payment || ''),
    price_type: unit > 0 ? 'rfq_fornecedor' : 'manual',
    score_display:
      payload.score != null && Number.isFinite(Number(payload.score))
        ? Number(payload.score)
        : null,
    score_label: payload.score_label != null ? String(payload.score_label) : null,
  });
  payload.quote_id = q.id;
  return payload;
}

export async function submit(
  store: SqliteIntranetStore,
  input: {
    requesterEmail: string;
    title: string;
    payload: Record<string, unknown>;
    supplier_name?: string | null;
    supplier_email?: string | null;
  },
): Promise<{ request: IntranetRequestRecord } | { error: string }> {
  const requester = store.getEmployeeByEmail(input.requesterEmail);
  if (!requester || !requester.is_active) return { error: 'SEM_PERMISSAO' };

  const resolved = resolveApprover({
    requesterId: requester.id,
    sectors: store.listSectors(),
    employees: store.resolverEmployees(),
  });
  if ('error' in resolved) return { error: resolved.error };

  try {
    const request = store.withTx(() => {
      const payload = ensureQuoteIdOnPayload(store, input);
      const rec = store.insertRequest({
        requester_employee_id: requester.id,
        from_sector_id: requester.sector_id,
        to_sector_id: resolved.sectorId,
        title: input.title,
        payload,
        supplier_name: input.supplier_name,
        supplier_email: input.supplier_email,
        status: 'IN_REVIEW',
      });
      const assignment = store.insertAssignment({
        request_id: rec.id,
        assigned_employee_id: resolved.employeeId,
        assigned_sector_id: resolved.sectorId,
        step_number: 1,
      });
      store.insertAudit({
        request_id: rec.id,
        actor_employee_id: requester.id,
        event: 'SUBMIT',
        detail: { approver: resolved.employeeId },
      });
      const full = store.getRequest(rec.id)!;
      enqueueAssignmentNotify(store, {
        request: full,
        assignmentId: assignment.id,
        assigneeEmployeeId: resolved.employeeId,
      });
      return full;
    });
    return { request };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'FALHA_SUBMIT' };
  }
}

export async function executeStepDecision(
  store: SqliteIntranetStore,
  input: {
    requestId: string;
    actorEmail: string;
    action: DecisionAction;
    reason: string;
    expectedVersion: number;
    /** Audit meta — e.g. email_token when decided via /approve/:token */
    channel?: string;
  },
): Promise<{ request: IntranetRequestRecord } | { error: string }> {
  const actor = store.getEmployeeByEmail(input.actorEmail);
  if (!actor || !actor.is_active) return { error: 'SEM_PERMISSAO' };

  const current = store.getRequest(input.requestId);
  if (!current) return { error: 'NOT_FOUND' };
  if (current.version !== input.expectedVersion) return { error: 'VERSION_CONFLICT' };
  if (current.assigned_employee_id !== actor.id) return { error: 'ACTOR_NAO_ASSIGNED' };

  if ((input.action === 'REJECT' || input.action === 'REQUEST_CHANGES') && !input.reason.trim()) {
    return { error: 'MOTIVO_OBRIGATORIO' };
  }

  if (!canTransition(current.status, input.action)) {
    return { error: `TRANSICAO_INVALIDA: ${current.status} + ${input.action}` };
  }

  if (input.action === 'APPROVE' && missingCommercialForApprove(current.payload)) {
    return { error: 'PRECO_INCOMPLETO' };
  }

  const isLastStep = current.current_step >= current.total_steps;
  let status: IntranetRequestRecord['status'];
  try {
    status = nextStatus(current.status, input.action, { isLastStep });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'TRANSICAO_INVALIDA' };
  }

  try {
    const request = store.withTx(() => {
      store.deactivateAssignments(current.id);
      store.insertDecision({
        request_id: current.id,
        actor_employee_id: actor.id,
        action: input.action,
        reason: input.reason,
      });
      if (status === 'APPROVED') {
        store.insertOutbox({
          request_id: current.id,
          event_type: 'WORKFLOW.APPROVED',
          payload: {
            to: current.supplier_email,
            supplierName: current.supplier_name,
            code: current.code,
            item: String(current.payload.item || ''),
            volume: String(current.payload.volume || ''),
            state: String(current.payload.state_label || current.payload.state || ''),
            payment: String(current.payload.payment || ''),
            notes: current.payload.notes ? String(current.payload.notes) : undefined,
          },
        });
      }
      store.updateRequest(current.id, {
        status,
        version: current.version + 1,
        email_status: status === 'APPROVED' ? 'queued' : null,
      });
      store.insertAudit({
        request_id: current.id,
        actor_employee_id: actor.id,
        event: input.action,
        detail: {
          reason: input.reason,
          next: status,
          ...(input.channel ? { channel: input.channel } : {}),
        },
      });
      return store.getRequest(current.id)!;
    });
    return { request };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'FALHA_DECISAO' };
  }
}

export async function resubmit(
  store: SqliteIntranetStore,
  input: { requestId: string; actorEmail: string; expectedVersion: number },
): Promise<{ request: IntranetRequestRecord } | { error: string }> {
  const actor = store.getEmployeeByEmail(input.actorEmail);
  if (!actor) return { error: 'SEM_PERMISSAO' };
  const current = store.getRequest(input.requestId);
  if (!current) return { error: 'NOT_FOUND' };
  if (current.version !== input.expectedVersion) return { error: 'VERSION_CONFLICT' };
  if (current.requester_employee_id !== actor.id) return { error: 'SEM_PERMISSAO' };
  if (!canTransition(current.status, 'RESUBMIT')) {
    return { error: `TRANSICAO_INVALIDA: ${current.status} + RESUBMIT` };
  }
  const resolved = resolveApprover({
    requesterId: actor.id,
    sectors: store.listSectors(),
    employees: store.resolverEmployees(),
  });
  if ('error' in resolved) return { error: resolved.error };
  const request = store.withTx(() => {
    store.invalidateApprovalTokensForRequest(current.id);
    store.deactivateAssignments(current.id);
    const assignment = store.insertAssignment({
      request_id: current.id,
      assigned_employee_id: resolved.employeeId,
      assigned_sector_id: resolved.sectorId,
      step_number: current.current_step,
    });
    store.updateRequest(current.id, { status: 'IN_REVIEW', version: current.version + 1 });
    store.insertAudit({
      request_id: current.id,
      actor_employee_id: actor.id,
      event: 'RESUBMIT',
    });
    const full = store.getRequest(current.id)!;
    enqueueAssignmentNotify(store, {
      request: full,
      assignmentId: assignment.id,
      assigneeEmployeeId: resolved.employeeId,
    });
    return full;
  });
  return { request };
}

export async function cancel(
  store: SqliteIntranetStore,
  input: { requestId: string; actorEmail: string; expectedVersion: number },
): Promise<{ request: IntranetRequestRecord } | { error: string }> {
  const actor = store.getEmployeeByEmail(input.actorEmail);
  if (!actor) return { error: 'SEM_PERMISSAO' };
  const current = store.getRequest(input.requestId);
  if (!current) return { error: 'NOT_FOUND' };
  if (current.version !== input.expectedVersion) return { error: 'VERSION_CONFLICT' };
  if (current.requester_employee_id !== actor.id) return { error: 'SEM_PERMISSAO' };
  if (!canTransition(current.status, 'CANCEL')) {
    return { error: `TRANSICAO_INVALIDA: ${current.status} + CANCEL` };
  }
  const request = store.withTx(() => {
    store.deactivateAssignments(current.id);
    store.updateRequest(current.id, { status: 'CANCELED', version: current.version + 1 });
    store.insertAudit({
      request_id: current.id,
      actor_employee_id: actor.id,
      event: 'CANCEL',
    });
    return store.getRequest(current.id)!;
  });
  return { request };
}

export function previewApprover(store: SqliteIntranetStore, requesterEmail: string) {
  const requester = store.getEmployeeByEmail(requesterEmail);
  if (!requester || !effectivePerms(requester).can_request) {
    return { error: 'SEM_PERMISSAO' as const };
  }
  const resolved = resolveApprover({
    requesterId: requester.id,
    sectors: store.listSectors(),
    employees: store.resolverEmployees(),
  });
  if ('error' in resolved) return resolved;
  const emp = store.getEmployee(resolved.employeeId);
  const sector = store.listSectors().find((s) => s.id === resolved.sectorId);
  return {
    employeeId: resolved.employeeId,
    sectorId: resolved.sectorId,
    full_name: emp?.full_name || '',
    job_title: emp?.job_title_name || '',
    sector_name: sector?.name || emp?.sector_name || '',
    email: emp?.email || '',
  };
}
