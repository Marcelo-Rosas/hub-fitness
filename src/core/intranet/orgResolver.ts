export function effectivePerms(input: {
  can_request: boolean;
  can_approve: boolean;
  can_request_override: boolean | null;
  can_approve_override: boolean | null;
}): { can_request: boolean; can_approve: boolean } {
  return {
    can_request: input.can_request_override ?? input.can_request,
    can_approve: input.can_approve_override ?? input.can_approve,
  };
}

type Sector = { id: string; parent_id: string | null; head_employee_id: string | null };
type Employee = {
  id: string;
  sector_id: string;
  is_active: boolean;
  can_request: boolean;
  can_approve: boolean;
  can_request_override: boolean | null;
  can_approve_override: boolean | null;
};

export function resolveApprover(input: {
  requesterId: string;
  sectors: Sector[];
  employees: Employee[];
}): { employeeId: string; sectorId: string } | { error: 'SEM_ALCADIA' | 'SEM_PERMISSAO' } {
  const requester = input.employees.find((e) => e.id === input.requesterId);
  if (!requester || !requester.is_active) return { error: 'SEM_PERMISSAO' };
  if (!effectivePerms(requester).can_request) return { error: 'SEM_PERMISSAO' };

  const sectorById = new Map(input.sectors.map((s) => [s.id, s]));
  const seen = new Set<string>();
  let sector = sectorById.get(requester.sector_id) ?? null;

  while (sector) {
    if (seen.has(sector.id)) break;
    seen.add(sector.id);

    const candidates = input.employees.filter((e) => {
      if (!e.is_active || e.sector_id !== sector!.id || e.id === requester.id) return false;
      return effectivePerms(e).can_approve;
    });

    if (candidates.length > 0) {
      const head = sector.head_employee_id
        ? candidates.find((e) => e.id === sector!.head_employee_id)
        : undefined;
      const chosen = head ?? candidates[0];
      return { employeeId: chosen.id, sectorId: sector.id };
    }

    sector = sector.parent_id ? (sectorById.get(sector.parent_id) ?? null) : null;
  }

  return { error: 'SEM_ALCADIA' };
}
