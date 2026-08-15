export type ApprovalStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED';

export type DecisionAction = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

export type FsmEvent =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CHANGES'
  | 'RESUBMIT'
  | 'CANCEL';

export type IntranetKind = 'rfq';
export type IntranetEmailStatus = 'queued' | 'sent' | 'simulated' | 'failed' | null;

export interface IntranetSectorRecord {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  head_employee_id: string | null;
}

export interface IntranetJobTitleRecord {
  id: string;
  name: string;
  can_request: boolean;
  can_approve: boolean;
}

export interface IntranetEmployeeRecord {
  id: string;
  email: string;
  full_name: string;
  sector_id: string;
  job_title_id: string;
  reports_to: string | null;
  can_request_override: boolean | null;
  can_approve_override: boolean | null;
  is_active: boolean;
  job_title_name?: string;
  sector_code?: string;
  sector_name?: string;
}

export interface IntranetRequestRecord {
  id: string;
  code: string;
  title: string;
  status: ApprovalStatus;
  version: number;
  payload: Record<string, unknown>;
  supplier_name: string | null;
  supplier_email: string | null;
  requester_employee_id: string;
  requester_email?: string;
  from_sector_id: string | null;
  to_sector_id: string | null;
  current_step: number;
  total_steps: number;
  created_at: string;
  updated_at: string;
  assigned_employee_id?: string | null;
  assigned_employee_email?: string | null;
  assigned_employee_name?: string | null;
  assigned_sector_id?: string | null;
  assigned_sector_name?: string | null;
  email_status: IntranetEmailStatus;
  email_error: string | null;
  last_decision_reason?: string | null;
  last_decision_action?: string | null;
}

export interface IntranetCadastroContatoRecord {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  /** Código do plano de contas (cargo / responsabilidade). */
  account_code: string;
  account_name: string;
  created_at: string;
  updated_at: string;
}

export interface IntranetOutboxRecord {
  id: string;
  request_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  attempts: number;
  last_error: string | null;
}

export type ApproverPreview =
  | {
      employeeId: string;
      sectorId: string;
      full_name: string;
      job_title: string;
      sector_name: string;
      email: string;
    }
  | { error: 'SEM_ALCADIA' | 'SEM_PERMISSAO' };
