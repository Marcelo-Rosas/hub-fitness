import { canTransition, nextStatus } from './fsm';
import { effectivePerms, resolveApprover } from './orgResolver';
import type { SqliteIntranetStore } from './intranetStore';
import type { DecisionAction, IntranetRequestRecord } from '../../types/intranet';

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
      const rec = store.insertRequest({
        requester_employee_id: requester.id,
        from_sector_id: requester.sector_id,
        to_sector_id: resolved.sectorId,
        title: input.title,
        payload: input.payload,
        supplier_name: input.supplier_name,
        supplier_email: input.supplier_email,
        status: 'IN_REVIEW',
      });
      store.insertAssignment({
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
      return store.getRequest(rec.id)!;
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
        detail: { reason: input.reason, next: status },
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
    store.deactivateAssignments(current.id);
    store.insertAssignment({
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
    return store.getRequest(current.id)!;
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
