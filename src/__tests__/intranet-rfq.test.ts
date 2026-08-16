import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SqliteIntranetStore, resetIntranetStoreForTests } from '../core/intranet/intranetStore';
import { executeStepDecision, submit } from '../core/intranet/approvalService';
import { dispatchOutboxOnce } from '../core/intranet/outboxDispatcher';
import { canTransition, nextStatus } from '../core/intranet/fsm';
import { effectivePerms, resolveApprover } from '../core/intranet/orgResolver';

const ORG_SEED = {
  sectors: [
    { id: 'dir', parent_id: null, head_employee_id: 'socio' },
    { id: 'fin', parent_id: 'dir', head_employee_id: 'cfo' },
    { id: 'com', parent_id: 'fin', head_employee_id: null },
  ],
  employees: [
    {
      id: 'assistente',
      sector_id: 'com',
      is_active: true,
      can_request: true,
      can_approve: false,
      can_request_override: null,
      can_approve_override: null,
    },
    {
      id: 'cfo',
      sector_id: 'fin',
      is_active: true,
      can_request: true,
      can_approve: true,
      can_request_override: null,
      can_approve_override: null,
    },
    {
      id: 'socio',
      sector_id: 'dir',
      is_active: true,
      can_request: false,
      can_approve: true,
      can_request_override: null,
      can_approve_override: null,
    },
  ],
};

describe('FSM', () => {
  it('DRAFT + SUBMIT → IN_REVIEW', () => {
    expect(canTransition('DRAFT', 'SUBMIT')).toBe(true);
    expect(nextStatus('DRAFT', 'SUBMIT', { isLastStep: true })).toBe('IN_REVIEW');
  });

  it('IN_REVIEW + APPROVE last → APPROVED', () => {
    expect(canTransition('IN_REVIEW', 'APPROVE')).toBe(true);
    expect(nextStatus('IN_REVIEW', 'APPROVE', { isLastStep: true })).toBe('APPROVED');
  });

  it('IN_REVIEW + APPROVE não-último permanece IN_REVIEW', () => {
    expect(nextStatus('IN_REVIEW', 'APPROVE', { isLastStep: false })).toBe('IN_REVIEW');
  });

  it('APPROVED + APPROVE é inválido', () => {
    expect(canTransition('APPROVED', 'APPROVE')).toBe(false);
  });

  it('CANCEL recusado em APPROVED', () => {
    expect(canTransition('APPROVED', 'CANCEL')).toBe(false);
  });
});

describe('orgResolver', () => {
  it('override null herda o cargo; override vence o template', () => {
    expect(
      effectivePerms({
        can_request: true,
        can_approve: false,
        can_request_override: null,
        can_approve_override: null,
      }),
    ).toEqual({ can_request: true, can_approve: false });

    expect(
      effectivePerms({
        can_request: true,
        can_approve: true,
        can_request_override: null,
        can_approve_override: false,
      }),
    ).toEqual({ can_request: true, can_approve: false });
  });

  it('assistente Compras sobe para FIN (CFO)', () => {
    expect(
      resolveApprover({ requesterId: 'assistente', ...ORG_SEED }),
    ).toEqual({ employeeId: 'cfo', sectorId: 'fin' });
  });

  it('CFO com override can_approve=false sobe para DIR (Sócio)', () => {
    const employees = ORG_SEED.employees.map((e) =>
      e.id === 'cfo' ? { ...e, can_approve_override: false } : e,
    );
    expect(
      resolveApprover({ requesterId: 'assistente', sectors: ORG_SEED.sectors, employees }),
    ).toEqual({ employeeId: 'socio', sectorId: 'dir' });
  });

  it('four-eyes: o requester não entra na lista mesmo com can_approve', () => {
    const employees = ORG_SEED.employees.map((e) =>
      e.id === 'assistente' ? { ...e, can_approve: true } : e,
    );
    expect(
      resolveApprover({ requesterId: 'assistente', sectors: ORG_SEED.sectors, employees }),
    ).toEqual({ employeeId: 'cfo', sectorId: 'fin' });
  });

  it('can_request_eff=false → SEM_PERMISSAO', () => {
    const employees = ORG_SEED.employees.map((e) =>
      e.id === 'assistente' ? { ...e, can_request_override: false } : e,
    );
    expect(
      resolveApprover({ requesterId: 'assistente', sectors: ORG_SEED.sectors, employees }),
    ).toEqual({ error: 'SEM_PERMISSAO' });
  });
});

describe('approvalService', () => {
  beforeEach(() => {
    resetIntranetStoreForTests();
  });

  it('SUBMIT do assistente cria assignment no CFO', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const result = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ Filme Stretch',
      payload: {
        item: 'Filme Stretch 500mm',
        volume: '150 un / mês',
        state: 'SC',
        payment: '30/60 dias no boleto',
      },
      supplier_name: 'Ecopack Madeiras',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.request.status).toBe('IN_REVIEW');
    expect(result.request.code.startsWith('RFQ-')).toBe(true);
    expect(result.request.assigned_employee_email).toBe('cfo@hubfitness.com.br');
    const outbox = store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.event_type).toBe('ASSIGNMENT.NOTIFY');
  });

  it('APPROVE com expectedVersion velha falha', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: { item: 'X' },
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);

    const stale = await executeStepDecision(store, {
      requestId: created.request.id,
      actorEmail: 'cfo@hubfitness.com.br',
      action: 'APPROVE',
      reason: '',
      expectedVersion: 0,
    });
    expect(stale).toEqual({ error: 'VERSION_CONFLICT' });
    expect(store.getRequest(created.request.id)?.status).toBe('IN_REVIEW');
  });

  it('APPROVE ok gera 1 outbox e zero fetch a api.resend.com', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: {
        item: 'Filme Stretch 500mm',
        volume: '150 un / mês',
        state: 'SC',
        payment: '30/60',
        unit_price: 41,
        freight_monthly: 200,
        landed_monthly: 6350,
        lead_time_days: 3,
      },
      supplier_name: 'Ecopack Madeiras',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);

    const decided = await executeStepDecision(store, {
      requestId: created.request.id,
      actorEmail: 'cfo@hubfitness.com.br',
      action: 'APPROVE',
      reason: '',
      expectedVersion: created.request.version,
    });
    if ('error' in decided) throw new Error(decided.error);
    expect(decided.request.status).toBe('APPROVED');
    const outbox = store.listOutbox();
    expect(outbox.map((e) => e.event_type).sort()).toEqual([
      'ASSIGNMENT.NOTIFY',
      'WORKFLOW.APPROVED',
    ]);
    expect(outbox.every((e) => e.status === 'PENDING')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('APPROVE sem preço/landed → PRECO_INCOMPLETO', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: { item: 'X', volume: '1 un / mês', unit_price: null, landed_monthly: null },
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);
    expect(created.request.payload.quote_id).toBeTruthy();

    const decided = await executeStepDecision(store, {
      requestId: created.request.id,
      actorEmail: 'cfo@hubfitness.com.br',
      action: 'APPROVE',
      reason: '',
      expectedVersion: created.request.version,
    });
    expect(decided).toEqual({ error: 'PRECO_INCOMPLETO' });
    expect(store.getRequest(created.request.id)?.status).toBe('IN_REVIEW');
  });

  it('dispatcher consome WORKFLOW.APPROVED e não vive no service', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: {
        item: 'Filme Stretch 500mm',
        volume: '150 un / mês',
        state: 'SC',
        payment: '30/60',
        unit_price: 41,
        freight_monthly: 200,
        landed_monthly: 6350,
      },
      supplier_name: 'Ecopack Madeiras',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);
    const decided = await executeStepDecision(store, {
      requestId: created.request.id,
      actorEmail: 'cfo@hubfitness.com.br',
      action: 'APPROVE',
      reason: '',
      expectedVersion: created.request.version,
    });
    if ('error' in decided) throw new Error(decided.error);

    const send = vi.fn(async () => ({ ok: true, mode: 'simulated' as const }));
    const sendAssignee = vi.fn(async () => ({ ok: true, mode: 'simulated' as const }));
    // NOTIFY first (FIFO), then supplier APPROVED
    await dispatchOutboxOnce(store, send, sendAssignee);
    expect(sendAssignee).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    await dispatchOutboxOnce(store, send, sendAssignee);
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.listOutbox().every((e) => e.status === 'PROCESSED')).toBe(true);
    expect(store.getRequest(created.request.id)?.email_status).toBe('simulated');
  });
});
