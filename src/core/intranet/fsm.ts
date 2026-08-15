import type { ApprovalStatus, FsmEvent } from '../../types/intranet';

const ALLOWED: Record<ApprovalStatus, readonly FsmEvent[]> = {
  DRAFT: ['SUBMIT', 'CANCEL'],
  IN_REVIEW: ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL'],
  CHANGES_REQUESTED: ['RESUBMIT', 'CANCEL'],
  APPROVED: [],
  REJECTED: [],
  CANCELED: [],
};

export function canTransition(from: ApprovalStatus, event: FsmEvent): boolean {
  return ALLOWED[from].includes(event);
}

export function nextStatus(
  from: ApprovalStatus,
  event: FsmEvent,
  opts: { isLastStep: boolean },
): ApprovalStatus {
  if (!canTransition(from, event)) {
    throw new Error(`TRANSICAO_INVALIDA: ${from} + ${event}`);
  }
  if (event === 'SUBMIT' || event === 'RESUBMIT') return 'IN_REVIEW';
  if (event === 'REJECT') return 'REJECTED';
  if (event === 'REQUEST_CHANGES') return 'CHANGES_REQUESTED';
  if (event === 'CANCEL') return 'CANCELED';
  return opts.isLastStep ? 'APPROVED' : 'IN_REVIEW';
}
