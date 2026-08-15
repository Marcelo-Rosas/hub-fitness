import React, { useMemo, useState } from 'react';
import { Lock, Plus, RotateCcw, X } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { usePlanner } from '../../context/PlannerContext';
import { DreGranularItem, DreSection } from '../../types';
import { isLedgerItemLocked } from '../../core/engine';
import { canEditFinance } from '../../core/rbac/moduleEdit';
import {
  AccountItem,
  COA_PICKER_GROUPS,
  CoaPickerGroup,
  resolvePickerGroup,
} from '../../data/planoDeContasData';
import { SearchableSelect } from '../ui/SearchableSelect';

const SECTION_META: Record<
  DreSection,
  { label: string; header: string; accent: string; border: string; total: string }
> = {
  receita: {
    label: 'RECEITAS',
    header: 'bg-emerald-950 text-emerald-300',
    accent: 'border-emerald-800',
    border: 'border-slate-800',
    total: 'text-emerald-400',
  },
  custo: {
    label: 'CUSTOS (COGS)',
    header: 'bg-rose-950 text-rose-300',
    accent: 'border-rose-800',
    border: 'border-slate-800',
    total: 'text-rose-300',
  },
  despesa: {
    label: 'DESPESAS (OPEX)',
    header: 'bg-amber-950 text-amber-300',
    accent: 'border-amber-800',
    border: 'border-slate-800',
    total: 'text-amber-300',
  },
};

const fmt = (n: number) => n.toLocaleString('pt-BR');

type PanelMode = { kind: 'create'; section: DreSection } | { kind: 'edit'; id: string } | null;

export const M3CadastroFinanceiro: React.FC = () => {
  const {
    granularDreItems,
    addDreGranularItem,
    updateDreGranularItem,
    deleteDreGranularItem,
    resetDreGranularItems,
    chartOfAccounts,
    costCenters,
    addChartAccount,
    updateChartAccount,
    deleteChartAccount,
    addCostCenter,
    activeRole,
    pitchMode,
  } = usePlanner();

  const canEdit = canEditFinance(activeRole) && !pitchMode;
  const [panel, setPanel] = useState<PanelMode>({ kind: 'create', section: 'despesa' });
  const [name, setName] = useState('');
  const [y1, setY1] = useState('0');
  const [y2, setY2] = useState('0');
  const [group, setGroup] = useState<CoaPickerGroup>('custos_despesas');
  const [accountCode, setAccountCode] = useState('');
  const [ccId, setCcId] = useState('CC 002');
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newCcName, setNewCcName] = useState('');
  const [showNewCc, setShowNewCc] = useState(false);

  const kpis = useMemo(() => {
    const sum = (section: DreSection, year: 1 | 2) =>
      granularDreItems
        .filter((i) => i.active && i.section === section)
        .reduce((a, b) => a + (year === 1 ? b.monthlyAmountY1 : b.monthlyAmountY2), 0);
    const rec = sum('receita', 1);
    const cst = sum('custo', 1);
    const desp = sum('despesa', 1);
    return { rec, cst, desp, res: rec - cst - desp };
  }, [granularDreItems]);

  const grouped = useMemo(
    () =>
      (['receita', 'custo', 'despesa'] as DreSection[]).map((section) => ({
        section,
        items: granularDreItems.filter((i) => i.section === section),
        total: granularDreItems
          .filter((i) => i.active && i.section === section)
          .reduce((a, b) => a + b.monthlyAmountY1, 0),
      })),
    [granularDreItems],
  );

  const groupAccounts = chartOfAccounts.filter((a) => resolvePickerGroup(a) === group);
  const analyticAccounts = groupAccounts.filter((a) => a.type === 'Analítica');

  const openCreate = (section: DreSection) => {
    setPanel({ kind: 'create', section });
    setName('');
    setY1('0');
    setY2('0');
    setGroup(section === 'receita' ? 'receitas' : 'custos_despesas');
    setAccountCode('');
    setCcId('CC 002');
    setShowNewAccount(false);
  };

  const openEdit = (item: DreGranularItem) => {
    if (isLedgerItemLocked(item) || !canEdit) return;
    setPanel({ kind: 'edit', id: item.id });
    setName(item.name);
    setY1(String(item.monthlyAmountY1));
    setY2(String(item.monthlyAmountY2));
    const acc = chartOfAccounts.find((a) => a.code === item.accountCode);
    if (acc) setGroup(resolvePickerGroup(acc));
    setAccountCode(item.accountCode ?? '');
    setCcId(item.costCenterId ?? 'CC 002');
  };

  const saveLine = () => {
    if (!canEdit) return;
    const payload: Omit<DreGranularItem, 'id'> = {
      section: panel?.kind === 'create' ? panel.section : granularDreItems.find((i) => i.id === panel?.id)?.section ?? 'despesa',
      type: 'fixo',
      category: group,
      name: name.trim() || 'Nova linha',
      monthlyAmountY1: Number(y1) || 0,
      monthlyAmountY2: Number(y2) || 0,
      active: true,
      accountCode: accountCode || undefined,
      costCenterId: ccId,
    };
    if (panel?.kind === 'edit') updateDreGranularItem(panel.id, payload);
    else addDreGranularItem(payload);
  };

  const createAccount = () => {
    if (!newAccountCode.trim() || !newAccountName.trim()) return;
    const seed = groupAccounts[0];
    const created: AccountItem = {
      code: newAccountCode.trim(),
      name: newAccountName.trim(),
      level: 4,
      group: seed?.group ?? (group === 'receitas' ? 'RECEITAS' : 'CUSTOS E DESPESAS'),
      nature: group === 'receitas' ? 'Credora' : 'Devedora',
      type: 'Analítica',
      costCenterId: ccId,
    };
    if (addChartAccount(created)) {
      setAccountCode(created.code);
      setShowNewAccount(false);
      setNewAccountCode('');
      setNewAccountName('');
    }
  };

  const createCc = () => {
    if (!newCcName.trim()) return;
    const next = `CC ${String(costCenters.length + 1).padStart(3, '0')}`;
    if (
      addCostCenter({
        id: next,
        name: newCcName.trim(),
        description: newCcName.trim(),
        scope: 'Cadastro M3',
        recommendedKPI: '—',
      })
    ) {
      setCcId(next);
      setShowNewCc(false);
      setNewCcName('');
    }
  };

  return (
    <div className="space-y-4">
      <ModuleHeader
        moduleId="M3"
        title="Cadastro financeiro"
        subtitle="Única tela de edição. Receita, Custo e Despesa com Ano 1 / Ano 2 (R$/mês). M2 permanece somente leitura."
        kpis={[
          { label: 'Receita Y1 / mês', value: `R$ ${fmt(kpis.rec)}`, highlightColor: 'emerald', badge: 'RECEITA' },
          { label: 'Custo Y1 / mês', value: `R$ ${fmt(kpis.cst)}`, highlightColor: 'rose', badge: 'COGS' },
          { label: 'Despesa Y1 / mês', value: `R$ ${fmt(kpis.desp)}`, highlightColor: 'amber', badge: 'OPEX' },
          { label: 'Resultado Y1 / mês', value: `R$ ${fmt(kpis.res)}`, highlightColor: 'indigo', badge: 'Y1' },
        ]}
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={() => {
                if (confirm('Restaurar a semente do BP v3.5? Linhas novas serão perdidas.')) resetDreGranularItems();
              }}
              className="px-3.5 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar semente
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_336px] gap-4 items-start">
        <div className="space-y-4">
          {grouped.map(({ section, items, total }) => {
            const meta = SECTION_META[section];
            return (
              <div key={section} className={`bg-slate-900 rounded-xl border ${meta.accent} overflow-hidden`}>
                <div className={`flex items-center justify-between px-4 py-2.5 ${meta.header}`}>
                  <span className="text-xs font-extrabold tracking-wider">{meta.label}</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openCreate(section)}
                      className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Nova linha
                    </button>
                  )}
                </div>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-4">Conta</th>
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-3">CC</th>
                      <th className="py-2 px-3 text-right font-mono">Ano 1</th>
                      <th className="py-2 px-3 text-right font-mono">Ano 2</th>
                      <th className="py-2 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const locked = isLedgerItemLocked(item);
                      return (
                        <tr
                          key={item.id}
                          className={`border-t border-slate-800 ${locked ? 'bg-emerald-950/40' : item.id === 'cst-aluguel' ? 'bg-amber-950/30' : ''}`}
                        >
                          <td className="py-2.5 px-4 font-mono text-slate-200">{item.accountCode ?? '—'}</td>
                          <td className="py-2.5 px-3 text-slate-100">{item.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{item.costCenterId ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{fmt(item.monthlyAmountY1)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">{fmt(item.monthlyAmountY2)}</td>
                          <td className="py-2.5 px-3 text-right">
                            {locked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300 font-extrabold text-[10px]">
                                <Lock className="w-3 h-3" /> TRAVADA
                              </span>
                            ) : canEdit ? (
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => openEdit(item)} className="text-sky-400 font-bold cursor-pointer">
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteDreGranularItem(item.id)}
                                  className="text-rose-400 font-bold cursor-pointer"
                                >
                                  Excluir
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500">Leitura</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className={`px-4 py-2.5 text-right text-xs font-extrabold ${meta.total}`}>Total Y1 R$ {fmt(total)}</div>
              </div>
            );
          })}
        </div>

        {panel && (
          <aside className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden sticky top-4">
            <div className="bg-[#1F3864] text-white px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-extrabold">
                {panel.kind === 'create' ? `Nova linha · ${SECTION_META[panel.section].label}` : 'Editar linha'}
              </span>
              <button type="button" onClick={() => setPanel(null)} className="text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                placeholder="Ex.: Seguro patrimonial"
                className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Ano 1 R$/mês</label>
                  <input value={y1} onChange={(e) => setY1(e.target.value)} disabled={!canEdit} className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Ano 2 R$/mês</label>
                  <input value={y2} onChange={(e) => setY2(e.target.value)} disabled={!canEdit} className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono" />
                </div>
              </div>

              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1F3864]">Grupo do plano</label>
              <SearchableSelect
                value={group}
                disabled={!canEdit}
                options={COA_PICKER_GROUPS.map((g) => ({ value: g.id, label: g.label }))}
                onChange={(v) => {
                  setGroup((v || group) as CoaPickerGroup);
                  setAccountCode('');
                }}
                placeholder="Filtrar grupo…"
              />

              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1F3864]">Conta analítica</label>
              <SearchableSelect
                value={accountCode}
                disabled={!canEdit}
                options={analyticAccounts.map((acc) => ({
                  value: acc.code,
                  label: `${acc.code} · ${acc.name}`,
                }))}
                onChange={setAccountCode}
                placeholder={
                  analyticAccounts.length === 0
                    ? 'Nenhuma analítica neste grupo'
                    : 'Filtrar conta…'
                }
              />
              <p className="text-[10px] text-slate-500 -mt-1">
                Filtrado pelo grupo · só contas analíticas ({analyticAccounts.length})
              </p>

              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowNewAccount((v) => !v)} className="flex-1 h-7 rounded-lg bg-[#1F3864] text-white text-[11px] font-bold cursor-pointer">
                    + Criar conta
                  </button>
                  <button
                    type="button"
                    onClick={() => accountCode && deleteChartAccount(accountCode)}
                    className="flex-1 h-7 rounded-lg border border-rose-200 text-rose-700 text-[11px] font-bold cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              )}

              {showNewAccount && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-2">
                  <input value={newAccountCode} onChange={(e) => setNewAccountCode(e.target.value)} placeholder="Código 5.2.02.09" className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-mono" />
                  <input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="Nome da conta analítica" className="w-full h-8 px-2 rounded border border-slate-200 text-xs" />
                  <button type="button" onClick={createAccount} className="w-full h-7 rounded-lg bg-[#1F3864] text-white text-[11px] font-bold cursor-pointer">
                    Salvar conta
                  </button>
                </div>
              )}

              {accountCode && canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const next = prompt('Novo nome da conta', groupAccounts.find((a) => a.code === accountCode)?.name);
                    if (next) updateChartAccount(accountCode, { name: next });
                  }}
                  className="text-[11px] text-slate-600 underline"
                >
                  Renomear conta selecionada
                </button>
              )}

              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1F3864]">Centro de custo</label>
              <SearchableSelect
                value={ccId}
                disabled={!canEdit}
                options={costCenters.map((cc) => ({ value: cc.id, label: `${cc.id} · ${cc.name}` }))}
                onChange={setCcId}
                placeholder="Filtrar centro de custo…"
              />
              {canEdit && (
                <button type="button" onClick={() => setShowNewCc((v) => !v)} className="text-[11px] font-bold text-slate-600 cursor-pointer">
                  + Novo CC
                </button>
              )}
              {showNewCc && (
                <div className="flex gap-2">
                  <input value={newCcName} onChange={(e) => setNewCcName(e.target.value)} placeholder="Nome do CC" className="flex-1 h-8 px-2 rounded border border-slate-200 text-xs" />
                  <button type="button" onClick={createCc} className="px-3 rounded-lg bg-[#1F3864] text-white text-[11px] font-bold cursor-pointer">
                    Criar
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setPanel(null)} className="flex-1 h-9 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveLine}
                  disabled={!canEdit}
                  className="flex-1 h-9 rounded-lg bg-[#006100] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
                >
                  Salvar
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
