import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, CheckCircle2, XCircle, Clock, Network, Briefcase, Users, ContactRound } from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { ModuleHeader } from '../ModuleHeader';
import { SearchableSelect } from '../ui/SearchableSelect';
import { cadastroCoaOptions } from '../../core/compras/researchFromCoa';
import { canManageOrg } from '../../core/rbac/moduleEdit';
import type {
  ApprovalStatus,
  IntranetCadastroContatoRecord,
  IntranetEmployeeRecord,
  IntranetJobTitleRecord,
  IntranetRequestRecord,
  IntranetSectorRecord,
} from '../../types/intranet';

type Tab = 'fila' | 'arvore' | 'cargos' | 'funcionarios' | 'cadastro';

function headers(email?: string) {
  return {
    'Content-Type': 'application/json',
    ...(email ? { 'x-user-email': email } : {}),
  };
}

export const M19Intranet: React.FC = () => {
  const { user, activeRole } = usePlanner();
  const manageOrg = canManageOrg(activeRole);
  const actorEmail = user?.email || '';
  const [tab, setTab] = useState<Tab>('fila');
  const [rows, setRows] = useState<IntranetRequestRecord[]>([]);
  const [sectors, setSectors] = useState<IntranetSectorRecord[]>([]);
  const [employees, setEmployees] = useState<IntranetEmployeeRecord[]>([]);
  const [jobTitles, setJobTitles] = useState<IntranetJobTitleRecord[]>([]);
  const [cadastro, setCadastro] = useState<IntranetCadastroContatoRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [versionBanner, setVersionBanner] = useState(false);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const loadOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/intranet/org-tree');
      const json = await res.json();
      if (json.success) {
        setSectors(json.data.sectors || []);
        setEmployees(json.data.employees || []);
        setJobTitles(json.data.jobTitles || []);
      }
    } catch {
      setMsg('API intranet indisponível — reinicie npm run dev.');
    }
  }, []);

  const loadCadastro = useCallback(async () => {
    try {
      const res = await fetch('/api/intranet/cadastro');
      const json = await res.json();
      if (json.success) setCadastro(json.data || []);
    } catch {
      setMsg('API intranet indisponível — reinicie npm run dev.');
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/intranet/requests?inbox=1', { headers: headers(user?.email) });
      const json = await res.json();
      if (json.success) setRows(json.data || []);
    } catch {
      setMsg('API intranet indisponível — reinicie npm run dev.');
    }
  }, [user?.email]);

  useEffect(() => {
    if (!manageOrg && tab !== 'fila') setTab('fila');
  }, [manageOrg, tab]);

  useEffect(() => {
    void loadOrg();
    void loadInbox();
    void loadCadastro();
  }, [loadOrg, loadInbox, loadCadastro]);

  const decide = async (id: string, action: 'approve' | 'reject' | 'request-changes', version: number) => {
    setBusyId(id);
    setMsg(null);
    setVersionBanner(false);
    const reason = reasonById[id] || '';
    if (action !== 'approve' && !reason.trim()) {
      setMsg('Motivo obrigatório para rejeitar ou pedir correção.');
      setBusyId(null);
      return;
    }
    try {
      const res = await fetch(`/api/intranet/requests/${id}/${action}`, {
        method: 'POST',
        headers: headers(user?.email),
        body: JSON.stringify({ expectedVersion: version, reason }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setVersionBanner(true);
        throw new Error('Pedido atualizado por outro usuário. Recarregue a fila.');
      }
      if (!json.success) throw new Error(json.error || 'Falha na decisão');
      setMsg(
        action === 'approve'
          ? 'Aprovado. O e-mail ao fornecedor sai pelo outbox (simulado sem INTRANET_EMAIL_LIVE).'
          : action === 'reject'
            ? 'Solicitação rejeitada.'
            : 'Correção pedida ao solicitante.',
      );
      await loadInbox();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Falha');
    } finally {
      setBusyId(null);
    }
  };

  const pendingMine = rows.filter((r) => r.status === 'IN_REVIEW').length;

  return (
    <div className="space-y-6">
      <ModuleHeader
        moduleId="M19"
        title="Intranet · Alçada e aprovações"
        subtitle="O aprovador sai da árvore de setores. Aprovar grava outbox; Resend só com INTRANET_EMAIL_LIVE."
        kpis={[
          { label: 'Na sua fila', value: String(pendingMine), highlightColor: pendingMine ? 'amber' : 'emerald' },
          { label: 'Setores', value: String(sectors.length), highlightColor: 'slate' },
          { label: 'Cadastro', value: String(cadastro.length), highlightColor: 'slate' },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {(
          (
            manageOrg
              ? ([
                  ['fila', 'Fila', Inbox],
                  ['arvore', 'Árvore', Network],
                  ['cargos', 'Cargos', Briefcase],
                  ['funcionarios', 'Funcionários', Users],
                  ['cadastro', 'Cadastro', ContactRound],
                ] as const)
              : ([['fila', 'Fila', Inbox]] as const)
          )
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 cursor-pointer ${
              tab === id ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {versionBanner ? (
        <div className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Versão desatualizada (409). Recarregue a fila antes de decidir de novo.
        </div>
      ) : null}
      {msg ? <p className="text-xs text-teal-800 font-medium">{msg}</p> : null}

      {tab === 'fila' && (
        <Fila
          rows={rows}
          busyId={busyId}
          reasonById={reasonById}
          setReasonById={setReasonById}
          onDecide={decide}
        />
      )}
      {tab === 'arvore' && manageOrg && (
        <Arvore
          sectors={sectors}
          employees={employees}
          jobTitles={jobTitles}
          actorEmail={actorEmail}
          onSaved={loadOrg}
        />
      )}
      {tab === 'cargos' && manageOrg && (
        <Cargos jobTitles={jobTitles} actorEmail={actorEmail} onSaved={loadOrg} />
      )}
      {tab === 'funcionarios' && manageOrg && (
        <Funcionarios
          sectors={sectors}
          employees={employees}
          jobTitles={jobTitles}
          actorEmail={actorEmail}
          onSaved={loadOrg}
        />
      )}
      {tab === 'cadastro' && manageOrg && (
        <CadastroContatos
          rows={cadastro}
          actorEmail={actorEmail}
          onSaved={loadCadastro}
          onMsg={setMsg}
        />
      )}
    </div>
  );
};

function Fila({
  rows,
  busyId,
  reasonById,
  setReasonById,
  onDecide,
}: {
  rows: IntranetRequestRecord[];
  busyId: string | null;
  reasonById: Record<string, string>;
  setReasonById: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onDecide: (id: string, action: 'approve' | 'reject' | 'request-changes', version: number) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
        Nenhuma solicitação na sua alçada. Gere uma RFQ em Compras com o login compras@.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const canDecide = r.status === 'IN_REVIEW';
        return (
          <div key={r.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">{r.code}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {r.requester_email || 'Solicitante'} · {new Date(r.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {r.assigned_employee_name || r.assigned_employee_email} · {r.assigned_sector_name}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <Info label="Fornecedor" value={r.supplier_name || '—'} />
              <Info label="E-mail" value={r.supplier_email || '—'} />
              <Info label="Item" value={String(r.payload.item || '—')} />
            </div>
            <RfqCommercialBrief payload={r.payload} />
            {r.status === 'APPROVED' && (
              <div className="text-[11px] text-slate-600">
                {r.email_status === 'sent'
                  ? `E-mail enviado a ${r.supplier_email}`
                  : r.email_status === 'simulated' || r.email_status === 'queued'
                    ? 'E-mail na outbox (simulado sem INTRANET_EMAIL_LIVE)'
                    : r.email_error || 'Aguardando disparo'}
              </div>
            )}
            {canDecide && (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <input
                  value={reasonById[r.id] || ''}
                  onChange={(e) => setReasonById((m) => ({ ...m, [r.id]: e.target.value }))}
                  placeholder="Motivo (obrigatório para correção/rejeição)"
                  className="w-full h-8 px-3 text-xs border border-slate-200 rounded-lg"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => onDecide(r.id, 'approve', r.version)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => onDecide(r.id, 'request-changes', r.version)}
                    className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-900 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Pedir correção
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => onDecide(r.id, 'reject', r.version)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Rejeitar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Arvore({
  sectors,
  employees,
  jobTitles,
  actorEmail,
  onSaved,
}: {
  sectors: IntranetSectorRecord[];
  employees: IntranetEmployeeRecord[];
  jobTitles: IntranetJobTitleRecord[];
  actorEmail: string;
  onSaved: () => void;
}) {
  const roots = sectors.filter((s) => !s.parent_id);
  return (
    <div className="space-y-2">
      {roots.map((s) => (
        <SectorNode
          key={s.id}
          sector={s}
          sectors={sectors}
          employees={employees}
          jobTitles={jobTitles}
          actorEmail={actorEmail}
          depth={0}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}

function SectorNode({
  sector,
  sectors,
  employees,
  jobTitles,
  actorEmail,
  depth,
  onSaved,
}: {
  sector: IntranetSectorRecord;
  sectors: IntranetSectorRecord[];
  employees: IntranetEmployeeRecord[];
  jobTitles: IntranetJobTitleRecord[];
  actorEmail: string;
  depth: number;
  onSaved: () => void;
}) {
  const kids = sectors.filter((s) => s.parent_id === sector.id);
  const people = employees.filter((e) => e.sector_id === sector.id);
  return (
    <div style={{ marginLeft: depth * 16 }} className="border-l border-slate-200 pl-3 py-2">
      <div className="text-sm font-bold text-slate-800">
        {sector.name} <span className="text-[10px] font-mono text-slate-400">{sector.code}</span>
      </div>
      <div className="mt-1 space-y-1">
        {people.map((p) => {
          const job = jobTitles.find((j) => j.id === p.job_title_id);
          const req = p.can_request_override ?? job?.can_request ?? false;
          const appr = p.can_approve_override ?? job?.can_approve ?? false;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <span className="font-medium">{p.full_name}</span>
              <span className="text-slate-400">{job?.name}</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={req}
                  onChange={(e) =>
                    void patchEmployee(p.id, { can_request_override: e.target.checked }, actorEmail, onSaved)
                  }
                />
                Solicitar
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={appr}
                  onChange={(e) =>
                    void patchEmployee(p.id, { can_approve_override: e.target.checked }, actorEmail, onSaved)
                  }
                />
                Aprovar
              </label>
            </div>
          );
        })}
      </div>
      {kids.map((k) => (
        <SectorNode
          key={k.id}
          sector={k}
          sectors={sectors}
          employees={employees}
          jobTitles={jobTitles}
          actorEmail={actorEmail}
          depth={depth + 1}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}

async function patchEmployee(
  id: string,
  body: Record<string, unknown>,
  actorEmail: string,
  onSaved: () => void,
) {
  await fetch(`/api/intranet/employees/${id}`, {
    method: 'PATCH',
    headers: headers(actorEmail),
    body: JSON.stringify(body),
  });
  onSaved();
}

function Cargos({
  jobTitles,
  actorEmail,
  onSaved,
}: {
  jobTitles: IntranetJobTitleRecord[];
  actorEmail: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void fetch('/api/intranet/job-titles', {
            method: 'POST',
            headers: headers(actorEmail),
            body: JSON.stringify({ name, can_request: false, can_approve: false }),
          }).then(() => {
            setName('');
            onSaved();
          });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Novo cargo"
          className="h-8 px-3 text-xs border border-slate-200 rounded-lg"
        />
        <button type="submit" className="h-8 px-3 text-xs font-bold bg-[#1F3864] text-white rounded-lg cursor-pointer">
          Incluir cargo
        </button>
      </form>
      <div className="space-y-2">
        {jobTitles.map((j) => (
          <div key={j.id} className="flex flex-wrap items-center gap-4 text-sm border-b border-slate-100 py-2">
            <span className="font-medium w-56">{j.name}</span>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={j.can_request}
                onChange={(e) =>
                  void fetch(`/api/intranet/job-titles/${j.id}`, {
                    method: 'PATCH',
                    headers: headers(actorEmail),
                    body: JSON.stringify({ can_request: e.target.checked }),
                  }).then(onSaved)
                }
              />
              Solicitar
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={j.can_approve}
                onChange={(e) =>
                  void fetch(`/api/intranet/job-titles/${j.id}`, {
                    method: 'PATCH',
                    headers: headers(actorEmail),
                    body: JSON.stringify({ can_approve: e.target.checked }),
                  }).then(onSaved)
                }
              />
              Aprovar
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funcionarios({
  sectors,
  employees,
  jobTitles,
  actorEmail,
  onSaved,
}: {
  sectors: IntranetSectorRecord[];
  employees: IntranetEmployeeRecord[];
  jobTitles: IntranetJobTitleRecord[];
  actorEmail: string;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [sectorId, setSectorId] = useState(sectors[0]?.id || '');
  const [jobId, setJobId] = useState(jobTitles[0]?.id || '');
  useEffect(() => {
    if (!sectorId && sectors[0]) setSectorId(sectors[0].id);
    if (!jobId && jobTitles[0]) setJobId(jobTitles[0].id);
  }, [sectors, jobTitles, sectorId, jobId]);

  const sectorOpts = useMemo(() => sectors.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })), [sectors]);
  const jobOpts = useMemo(() => jobTitles.map((j) => ({ value: j.id, label: j.name })), [jobTitles]);

  return (
    <div className="space-y-4">
      <form
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!fullName.trim() || !email.trim()) return;
          void fetch('/api/intranet/employees', {
            method: 'POST',
            headers: headers(actorEmail),
            body: JSON.stringify({
              full_name: fullName,
              email,
              sector_id: sectorId,
              job_title_id: jobId,
            }),
          }).then(() => {
            setFullName('');
            setEmail('');
            onSaved();
          });
        }}
      >
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nome"
          className="h-8 px-3 text-xs border border-slate-200 rounded-lg"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail"
          className="h-8 px-3 text-xs border border-slate-200 rounded-lg"
        />
        <SearchableSelect value={sectorId} options={sectorOpts} onChange={setSectorId} required />
        <SearchableSelect value={jobId} options={jobOpts} onChange={setJobId} required />
        <button type="submit" className="h-8 px-3 text-xs font-bold bg-[#1F3864] text-white rounded-lg cursor-pointer">
          Incluir
        </button>
      </form>
      <div className="space-y-2">
        {employees.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 text-xs border-b border-slate-100 py-2">
            <span className="font-medium w-40">{e.full_name}</span>
            <span className="text-slate-500 w-52">{e.email}</span>
            <span className="w-32">{e.sector_name}</span>
            <span className="w-40">{e.job_title_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CadastroContatos({
  rows,
  actorEmail,
  onSaved,
  onMsg,
}: {
  rows: IntranetCadastroContatoRecord[];
  actorEmail: string;
  onSaved: () => void;
  onMsg: (msg: string | null) => void;
}) {
  const coaOpts = useMemo(() => cadastroCoaOptions(), []);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accountCode, setAccountCode] = useState(coaOpts[0]?.value || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accountCode && coaOpts[0]) setAccountCode(coaOpts[0].value);
  }, [coaOpts, accountCode]);

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setAccountCode(coaOpts[0]?.value || '');
    setEditingId(null);
  };

  const startEdit = (row: IntranetCadastroContatoRecord) => {
    setEditingId(row.id);
    setFullName(row.full_name);
    setPhone(row.phone);
    setEmail(row.email);
    setAccountCode(row.account_code);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !accountCode) {
      onMsg('Preencha nome, e-mail e cargo (conta do plano).');
      return;
    }
    setBusy(true);
    onMsg(null);
    try {
      const res = await fetch(editingId ? `/api/intranet/cadastro/${editingId}` : '/api/intranet/cadastro', {
        method: editingId ? 'PATCH' : 'POST',
        headers: headers(actorEmail),
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          account_code: accountCode,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao salvar');
      onMsg(editingId ? 'Cadastro atualizado.' : 'Cadastro incluído.');
      resetForm();
      onSaved();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : 'Falha ao salvar cadastro');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    onMsg(null);
    try {
      const res = await fetch(`/api/intranet/cadastro/${id}`, {
        method: 'DELETE',
        headers: headers(actorEmail),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao excluir');
      if (editingId === id) resetForm();
      onSaved();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Cadastro de pessoas: <strong>nome · cargo (plano de contas) · telefone · e-mail</strong>. Cargo =
        conta analítica do plano.
      </p>
      <form
        onSubmit={(e) => void submit(e)}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl p-3"
      >
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400">Nome</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo"
            className="w-full h-8 px-3 text-xs border border-slate-200 rounded-lg bg-white"
            required
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400">Cargo (Plano de Contas)</label>
          <SearchableSelect
            value={accountCode}
            options={coaOpts}
            onChange={setAccountCode}
            required
            placeholder="Filtrar conta…"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400">Telefone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(47) 99999-0000"
            className="w-full h-8 px-3 text-xs border border-slate-200 rounded-lg bg-white"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-400">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            className="w-full h-8 px-3 text-xs border border-slate-200 rounded-lg bg-white"
            required
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="h-8 px-3 text-xs font-bold bg-[#1F3864] text-white rounded-lg cursor-pointer disabled:opacity-50"
          >
            {editingId ? 'Salvar' : 'Incluir'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 text-xs font-semibold border border-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
            Nenhum contato cadastrado. Inclua nome, conta do plano, telefone e e-mail.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 text-xs border border-slate-100 rounded-lg px-3 py-2 bg-white"
            >
              <span className="font-semibold text-slate-900 w-40 truncate">{row.full_name}</span>
              <span className="font-mono text-blue-800 w-56 truncate" title={`${row.account_code} · ${row.account_name}`}>
                {row.account_code} · {row.account_name}
              </span>
              <span className="text-slate-600 w-32 truncate">{row.phone || '—'}</span>
              <span className="text-slate-600 w-52 truncate">{row.email}</span>
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startEdit(row)}
                  className="px-2 py-1 rounded border border-slate-200 text-slate-700 font-semibold cursor-pointer disabled:opacity-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(row.id)}
                  className="px-2 py-1 rounded border border-rose-200 text-rose-800 font-semibold cursor-pointer disabled:opacity-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function moneyBrl(n: unknown): string | null {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function RfqCommercialBrief({ payload }: { payload: Record<string, unknown> }) {
  const unit = moneyBrl(payload.unit_price);
  const freight = moneyBrl(payload.freight_monthly);
  const landed = moneyBrl(payload.landed_monthly);
  const leadRaw = payload.lead_time_days ?? payload.delivery_lead_time_days;
  const lead =
    leadRaw != null && Number.isFinite(Number(leadRaw)) && Number(leadRaw) > 0
      ? `${Number(leadRaw)} dia(s)`
      : null;
  const volume = payload.volume != null ? String(payload.volume) : null;
  const payment = payload.payment != null ? String(payload.payment) : null;
  const account = payload.account_code != null ? String(payload.account_code) : null;
  const dest =
    payload.state_label != null
      ? String(payload.state_label)
      : payload.warehouse_code != null
        ? String(payload.warehouse_code)
        : null;
  const score =
    payload.score != null && Number.isFinite(Number(payload.score))
      ? `${Number(payload.score)}/100`
      : null;
  const category = payload.category != null ? String(payload.category) : null;

  const gaps: string[] = [];
  if (!unit) gaps.push('preço unitário');
  if (!landed) gaps.push('landed mensal');
  if (!lead) gaps.push('prazo de entrega');
  if (!volume || /(?:^|\s)1\s*un/i.test(volume)) gaps.push('volume operacional');

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
        <Info label="Conta CoA" value={account || '—'} />
        <Info label="Categoria" value={category || '—'} />
        <Info label="Volume" value={volume || '—'} />
        <Info label="Pagamento" value={payment || '—'} />
        <Info label="Preço unitário" value={unit || '—'} />
        <Info label="Frete / mês" value={freight || '—'} />
        <Info label="Landed / mês" value={landed || '—'} />
        <Info label="Prazo → hub SC" value={lead || '—'} />
        <Info label="Destino" value={dest || '—'} />
        <Info label="Score" value={score || '—'} />
      </div>
      {gaps.length > 0 ? (
        <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
          Dossiê incompleto para alçada: falta {gaps.join(', ')}. Preferir{' '}
          <strong>Pedir correção</strong> em vez de aprovar às cegas.
        </p>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</div>
      <div className="text-slate-800 font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, string> = {
    DRAFT: 'Rascunho',
    IN_REVIEW: 'Em análise',
    CHANGES_REQUESTED: 'Correção',
    APPROVED: 'Aprovada',
    REJECTED: 'Rejeitada',
    CANCELED: 'Cancelada',
  };
  const color =
    status === 'APPROVED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'REJECTED' || status === 'CANCELED'
        ? 'bg-rose-100 text-rose-800'
        : status === 'IN_REVIEW'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${color} inline-flex items-center gap-1`}>
      {status === 'IN_REVIEW' ? <Clock className="w-3 h-3" /> : null}
      {map[status]}
    </span>
  );
}
