import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { UserRole, AuthUser, Scenario, ScenarioDrivers, VasDriver, AuditLog, GovernanceCheck, DreMonth, CellData, DreGranularItem, MappedVsImplementedCostItem, SupplierCompany, SupplierQuote, ClientMixWeights } from '../types';
import { USER_ROLES, INITIAL_SCENARIOS, INITIAL_VAS_DRIVERS, INITIAL_AUDIT_LOGS, INITIAL_GOVERNANCE_CHECKS, INITIAL_GRANULAR_DRE_ITEMS, INITIAL_MAPPED_VS_IMPLEMENTED_COSTS, INITIAL_SUPPLIER_COMPANIES, INITIAL_SUPPLIER_QUOTES } from '../data/initialData';
import { HubParams, defaultParams } from '../core/params';
import {
  applyOccupancyToDreItems,
  applyTechOpexToDreItems,
  applyCliaToDreItems,
  projectDreFromLedger,
  isLedgerItemLocked,
  canPostToAccount,
  isAccountInUse,
  computeCliaSpineMonthly,
  plAdditionalForMonth,
  fatorRFolhaMensalFromLedger,
} from '../core/engine';
import { applyScenarioDrivers, deriveScenarioKpis } from '../core/scenarioDrivers';
import { OFFICIAL_TOTALS_24M } from '../core/bpV35Reference';
import { PLANO_DE_CONTAS_ITEMS, COST_CENTERS, AccountItem, CostCenter } from '../data/planoDeContasData';
import type { IngestParseResult } from '../ingest';

export const MOCK_BOARD_USERS: Record<string, AuthUser & { pass: string }> = {
  'cfo@hubfitness.com.br': {
    id: 'u-cfo',
    name: 'Dr. Roberto Mendes',
    email: 'cfo@hubfitness.com.br',
    role: 'cfo',
    title: 'CFO / Controller Sênior',
    pass: 'hub2026',
  },
  'socio@hubfitness.com.br': {
    id: 'u-socio',
    name: 'Carlos Eduardo',
    email: 'socio@hubfitness.com.br',
    role: 'socio',
    title: 'Sócio-Fundador / Board',
    pass: 'hub2026',
  },
  'comite@hubfitness.com.br': {
    id: 'u-comite',
    name: 'Juliana Paes',
    email: 'comite@hubfitness.com.br',
    role: 'comite',
    title: 'Comitê de Risco & Auditoria',
    pass: 'hub2026',
  },
  'comercial@hubfitness.com.br': {
    id: 'u-comercial',
    name: 'Fernando Silva',
    email: 'comercial@hubfitness.com.br',
    role: 'comercial',
    title: 'VP de Negócios & Vendas',
    pass: 'hub2026',
  },
  'compras@hubfitness.com.br': {
    id: 'u-compras',
    name: 'Ana Souza',
    email: 'compras@hubfitness.com.br',
    role: 'compras',
    title: 'Assistente de Compras',
    pass: 'hub2026',
  },
};

/** FR-01: papel → identidade board (e-mail = intranet x-user-email). */
export const BOARD_EMAIL_BY_ROLE: Record<UserRole, string> = {
  cfo: 'cfo@hubfitness.com.br',
  socio: 'socio@hubfitness.com.br',
  comite: 'comite@hubfitness.com.br',
  comercial: 'comercial@hubfitness.com.br',
  compras: 'compras@hubfitness.com.br',
};

interface InspectorCellInfo {
  cellId: string;
  label: string;
  value: number | string;
  formula?: string;
  formulaTree?: string[];
  moduleName?: string;
  unit?: string;
}

interface PlannerContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  pitchMode: boolean;
  setPitchMode: (pitch: boolean) => void;
  scenarios: Scenario[];
  scenariosSource: 'seed' | 'operator';
  financeSource: 'seed' | 'operator';
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
  activeScenario: Scenario;
  updateScenarioDrivers: (id: string, partial: Partial<ScenarioDrivers>) => void;
  vasDrivers: VasDriver[];
  updateVasDriver: (id: string, field: 'price' | 'quantityM7_12' | 'quantityM1_6' | 'quantityM13_24', value: number) => void;
  dreMonths: DreMonth[];
  updateDreValue: (monthIndex: number, field: keyof DreMonth, value: number) => void;
  /** Ledger sem ScenarioDrivers (Tornado / A/B). */
  ledgerBaseItems: DreGranularItem[];
  granularDreItems: DreGranularItem[];
  addDreGranularItem: (item: Omit<DreGranularItem, 'id'>) => void;
  updateDreGranularItem: (id: string, updated: Partial<DreGranularItem>) => void;
  deleteDreGranularItem: (id: string) => void;
  toggleDreGranularItem: (id: string) => void;
  resetDreGranularItems: () => void;
  mappedVsImplementedCosts: MappedVsImplementedCostItem[];
  supplierCompanies: SupplierCompany[];
  supplierQuotes: SupplierQuote[];
  applyQuoteToDre: (quoteId: string) => void;
  addSupplierQuote: (quote: Omit<SupplierQuote, 'id'>) => void;
  ingestComprasFromResearch: (
    parsed: IngestParseResult,
    opts?: { replaceAccountCode?: string; replaceMaterialCategory?: string },
  ) => { companies: number; quotes: number };
  fatorR: number; // e.g. 28.4
  setProlaboreMonthly: (val: number) => void;
  prolaboreMonthly: number;
  fatorRTargetBand: [number, number]; // [28.0, 28.7]
  applyFatorRTrigger: () => void;
  spinOffActive: boolean;
  setSpinOffActive: (active: boolean) => void;
  inspectorCell: InspectorCellInfo | null;
  openInspector: (cellInfo: InspectorCellInfo) => void;
  closeInspector: () => void;
  auditLogs: AuditLog[];
  governanceChecks: GovernanceCheck[];
  addAuditLog: (driver: string, before: string, after: string) => void;
  activeModule: string;
  setActiveModule: (module: string) => void;
  blockedValueAttempt: string | null;
  clearBlockedAttempt: () => void;
  duplicateScenario: (scenarioId: string) => void;
  createNewScenario: (name: string, occupancy: number) => void;
  activeMix: ClientMixWeights;
  updateActiveMix: (newMix: Partial<ClientMixWeights>) => void;
  applyMixToGlobalModel: (mixWeights: ClientMixWeights, weightedMcPos: number) => void;
  hubParams: HubParams;
  setHubParams: (updater: HubParams | ((prev: HubParams) => HubParams)) => void;
  cliaSpineMonthly: (monthNum: number) => number;
  chartOfAccounts: AccountItem[];
  costCenters: CostCenter[];
  addChartAccount: (account: AccountItem) => boolean;
  updateChartAccount: (code: string, patch: Partial<AccountItem>) => boolean;
  deleteChartAccount: (code: string) => boolean;
  addCostCenter: (cc: CostCenter) => boolean;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // User authentication state
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('hub_sim_user_v35');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao ler usuário do localStorage', e);
    }
    // Default logged in user for seamless demo if no saved session
    return MOCK_BOARD_USERS['cfo@hubfitness.com.br'];
  });

  // Derived activeRole strictly from user.role
  const activeRole: UserRole = useMemo(() => {
    return user ? user.role : 'cfo';
  }, [user]);

  const setActiveRole = (newRole: UserRole) => {
    const email = BOARD_EMAIL_BY_ROLE[newRole];
    const mockUser = MOCK_BOARD_USERS[email];
    if (!mockUser) return;
    const { pass: _, ...cleanUser } = mockUser;
    setUser(cleanUser);
    localStorage.setItem('hub_sim_user_v35', JSON.stringify(cleanUser));
    // Troca de identidade: limpa token mock antigo (intranet usa e-mail, não JWT)
    localStorage.setItem('hub_sim_token_v35', `mock-jwt-${newRole}-v35`);
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Tenta rota /api/auth/login do backend Express
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('hub_sim_user_v35', JSON.stringify(data.user));
          if (data.token) {
            localStorage.setItem('hub_sim_token_v35', data.token);
          }
          return { success: true };
        }
      }
    } catch (e) {
      console.warn('Backend API não disponível, utilizando validação local de fallback:', e);
    }

    // Fallback: Validação local contra Board Members mockados
    const lowerEmail = email.toLowerCase().trim();
    const mockUser = MOCK_BOARD_USERS[lowerEmail];
    if (mockUser && mockUser.pass === pass) {
      const { pass: _, ...cleanUser } = mockUser;
      setUser(cleanUser);
      localStorage.setItem('hub_sim_user_v35', JSON.stringify(cleanUser));
      localStorage.setItem('hub_sim_token_v35', `mock-jwt:${cleanUser.email}`);
      return { success: true };
    }

    return { success: false, error: 'Credenciais inválidas. Verifique o e-mail e senha informados.' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hub_sim_user_v35');
    localStorage.removeItem('hub_sim_token_v35');
  };

  const isAuthenticated = !!user;

  const [pitchMode, setPitchMode] = useState<boolean>(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(INITIAL_SCENARIOS);
  const [scenariosSource, setScenariosSource] = useState<'seed' | 'operator'>('seed');
  const [financeSource, setFinanceSource] = useState<'seed' | 'operator'>('seed');
  const financeSourceRef = React.useRef<'seed' | 'operator'>('seed');
  const financePersistTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [activeScenarioId, setActiveScenarioId] = useState<string>('sc-baseline');
  const [vasDrivers, setVasDrivers] = useState<VasDriver[]>(INITIAL_VAS_DRIVERS);
  const [granularDreItems, setGranularDreItems] = useState<DreGranularItem[]>(INITIAL_GRANULAR_DRE_ITEMS);
  const [chartOfAccounts, setChartOfAccounts] = useState<AccountItem[]>(PLANO_DE_CONTAS_ITEMS);
  const [costCenters, setCostCenters] = useState<CostCenter[]>(COST_CENTERS);
  const [mappedVsImplementedCosts, setMappedVsImplementedCosts] = useState<MappedVsImplementedCostItem[]>(INITIAL_MAPPED_VS_IMPLEMENTED_COSTS);
  const [supplierCompanies, setSupplierCompanies] = useState<SupplierCompany[]>(INITIAL_SUPPLIER_COMPANIES);
  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuote[]>(INITIAL_SUPPLIER_QUOTES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [activeModule, setActiveModule] = useState<string>('M1');
  const [inspectorCell, setInspectorCell] = useState<InspectorCellInfo | null>(null);
  const [spinOffActive, setSpinOffActive] = useState<boolean>(false);
  const [prolaboreMonthly, setProlaboreMonthly] = useState<number>(defaultParams.fiscal.plBaseMonthly);
  const [blockedValueAttempt, setBlockedValueAttempt] = useState<string | null>(null);
  const [hubParams, setHubParamsState] = useState<HubParams>(defaultParams);
  const setHubParams = (updater: HubParams | ((prev: HubParams) => HubParams)) => {
    setHubParamsState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  useEffect(() => {
    financeSourceRef.current = financeSource;
  }, [financeSource]);

  const scheduleFinancePersist = (key: string, run: () => void | Promise<unknown>) => {
    if (financeSourceRef.current !== 'operator') return;
    const prev = financePersistTimers.current[key];
    if (prev) clearTimeout(prev);
    financePersistTimers.current[key] = setTimeout(() => {
      void Promise.resolve(run()).catch(() => {
        /* network — handled inside run when possible */
      });
    }, 300);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/operator/scenarios');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.success || !Array.isArray(data.scenarios) || data.scenarios.length === 0) {
          return;
        }
        setScenarios(
          data.scenarios.map((s: Scenario) => ({
            ...s,
            drivers: s.drivers,
            occupancyRate: s.drivers?.occupancyRate ?? s.occupancyRate,
          })),
        );
        setScenariosSource('operator');
      } catch {
        /* keep seed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/operator/finance/bundle');
        if (!res.ok) return;
        const data = await res.json();
        if (
          cancelled ||
          !data?.success ||
          !Array.isArray(data.accounts) ||
          !Array.isArray(data.costCenters) ||
          !Array.isArray(data.ledger) ||
          data.accounts.length === 0 ||
          data.ledger.length === 0
        ) {
          return;
        }
        setChartOfAccounts(data.accounts);
        setCostCenters(data.costCenters);
        setGranularDreItems(data.ledger);
        setFinanceSource('operator');
      } catch {
        /* keep seed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rawActiveScenario = useMemo(() => {
    return scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];
  }, [scenarios, activeScenarioId]);

  const activeDrivers = rawActiveScenario.drivers;

  const occupancyDreItems = useMemo(
    () => applyOccupancyToDreItems(granularDreItems, hubParams),
    [granularDreItems, hubParams],
  );
  const techParams = useMemo(
    () => ({
      ...hubParams,
      techOpex: { ...hubParams.techOpex, active: activeDrivers.techOpexActive },
    }),
    [hubParams, activeDrivers.techOpexActive],
  );
  const techDreItems = useMemo(
    () => applyTechOpexToDreItems(occupancyDreItems, techParams),
    [occupancyDreItems, techParams],
  );
  const cliaDreItems = useMemo(
    () => applyCliaToDreItems(techDreItems, hubParams),
    [techDreItems, hubParams],
  );
  const derivedGranularDreItems = useMemo(
    () => applyScenarioDrivers(cliaDreItems, activeDrivers),
    [cliaDreItems, activeDrivers],
  );
  const cliaSpineMonthly = (monthNum: number) => computeCliaSpineMonthly(monthNum, hubParams);

  const [activeMix, setActiveMix] = useState<ClientMixWeights>({
    p1: 20,
    p2: 30,
    p4: 25,
    p5: 25,
    presetName: 'Blend Alvo (20/30/25/25)',
  });

  const updateActiveMix = (newMix: Partial<ClientMixWeights>) => {
    setActiveMix((prev) => ({ ...prev, ...newMix }));
  };

  const applyMixToGlobalModel = (mixWeights: ClientMixWeights, weightedMcPos: number) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Edição restrita: O perfil '${activeRole}' ou modo Pitch Mode ativo previne edições nas premissas de Mix.`);
      return;
    }

    setActiveMix(mixWeights);

    // Calculate revenue ratio compared to baseline Blend Alvo (MC/pos = 74.15)
    const ratio = weightedMcPos / 74.15;

    // Update granular DRE: receitas + custos variáveis (Mix→COGS P2)
    setGranularDreItems((prev) =>
      prev.map((item) => {
        if (item.section === 'receita' && !item.engineLocked && item.id !== 'rec-4pl-ct') {
          return {
            ...item,
            monthlyAmountY1: Math.round(item.monthlyAmountY1 * ratio),
            monthlyAmountY2: Math.round(item.monthlyAmountY2 * ratio),
          };
        }
        if (item.section === 'custo' && item.costBehavior === 'variable' && !item.engineLocked) {
          return {
            ...item,
            monthlyAmountY1: Math.round(item.monthlyAmountY1 * ratio),
            monthlyAmountY2: Math.round(item.monthlyAmountY2 * ratio),
          };
        }
        return item;
      })
    );

    addAuditLog(
      'Simulador de Mix',
      'Mix de Clientes Aplicado',
      `Novo Mix (P1: ${mixWeights.p1}%, P2: ${mixWeights.p2}%, P4: ${mixWeights.p4}%, P5: ${mixWeights.p5}%) -> MC/pos: R$ ${weightedMcPos.toFixed(2)}`
    );
  };

  // Recalculate 24-month DRE reactively from granular DRE items & scenario drivers
  const dreMonths = useMemo<DreMonth[]>(() => {
    return projectDreFromLedger(derivedGranularDreItems, activeDrivers.occupancyRate, hubParams);
  }, [derivedGranularDreItems, activeDrivers.occupancyRate, hubParams]);

  // Fator R: RBT12 + folha elegível do ledger base (hc + isFatorRNumerator; exclui MO terceirizada)
  const fatorR = useMemo(() => {
    if (!dreMonths || dreMonths.length === 0) return hubParams.fiscal.fatorRMin;

    const currentMonthIndex = dreMonths.findIndex((m, i) => i > 0 && m.receitaServicos === 0);
    const activeMonths = currentMonthIndex === -1 ? dreMonths : dreMonths.slice(0, currentMonthIndex);

    if (activeMonths.length === 0) return hubParams.fiscal.fatorRMin;

    const lastMonth = activeMonths[activeMonths.length - 1];
    const monthNum = lastMonth.month;
    const rbt12Start = Math.max(0, activeMonths.length - 12);
    const rbt12 = activeMonths.slice(rbt12Start).reduce((acc, m) => acc + m.receitaServicos, 0);
    const avgFolhaMensal = fatorRFolhaMensalFromLedger(granularDreItems, hubParams, monthNum);
    const folhaAcumulada12m = avgFolhaMensal * Math.min(activeMonths.length, 12);

    if (rbt12 === 0) return hubParams.fiscal.fatorRFloor;

    const ratio = (folhaAcumulada12m / rbt12) * 100;
    return Number(ratio.toFixed(2));
  }, [dreMonths, granularDreItems, hubParams]);

  const activeScenario = useMemo(() => {
    const kpis = deriveScenarioKpis(dreMonths, hubParams);
    return {
      ...rawActiveScenario,
      occupancyRate: activeDrivers.occupancyRate,
      llM7Plus: kpis.llM7Plus,
      m24Cash: kpis.m24Cash,
      capexTotal: kpis.capexTotal,
      fatorR,
    };
  }, [rawActiveScenario, activeDrivers.occupancyRate, dreMonths, hubParams, fatorR]);

  const updateScenarioDrivers = (id: string, partial: Partial<ScenarioDrivers>) => {
    const current = scenarios.find((s) => s.id === id);
    if (!current) return;
    const nextDrivers: ScenarioDrivers = { ...current.drivers, ...partial };
    const nextMeta: Scenario = {
      ...current,
      drivers: nextDrivers,
      occupancyRate: nextDrivers.occupancyRate,
    };
    setScenarios((prev) => prev.map((s) => (s.id === id ? nextMeta : s)));
    void fetch(`/api/operator/scenarios/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nextMeta.name,
        isBaseline: nextMeta.isBaseline,
        status: nextMeta.status,
        drivers: nextDrivers,
        notes: nextMeta.notes ?? null,
        mitigationStrategy: nextMeta.mitigationStrategy ?? null,
      }),
    }).catch(() => {
      /* offline: local state already updated */
    });
  };

  const governanceChecks = useMemo((): GovernanceCheck[] => {
    const fatorOk = fatorR >= hubParams.fiscal.fatorRMin && fatorR <= hubParams.fiscal.fatorRMax;
    const capexOk = hubParams.capex.total === defaultParams.capex.total;
    const dasOk = Math.abs(hubParams.pricing.dasPct - defaultParams.pricing.dasPct) < 1e-9;
    const rbt12 = dreMonths.slice(-12).reduce((a, m) => a + m.receitaServicos, 0);
    const tetoOk = rbt12 <= 4_800_000;

    return INITIAL_GOVERNANCE_CHECKS.map((c) => {
      if (c.id === 'gov-1') {
        return {
          ...c,
          status: capexOk ? 'passed' : 'warning',
          detail: capexOk
            ? `CAPEX ancorado em R$ ${hubParams.capex.total.toLocaleString('pt-BR')} (params).`
            : `CAPEX divergente do BP canônico (atual R$ ${hubParams.capex.total.toLocaleString('pt-BR')}).`,
        };
      }
      if (c.id === 'gov-3') {
        return {
          ...c,
          status: dasOk ? 'passed' : 'warning',
          detail: dasOk
            ? `DAS ${(hubParams.pricing.dasPct * 100).toFixed(2)}% Anexo III com Fator R na banda params.`
            : `DAS divergente: ${(hubParams.pricing.dasPct * 100).toFixed(2)}%.`,
        };
      }
      if (c.id === 'gov-5') {
        return {
          ...c,
          status: fatorOk ? 'passed' : 'warning',
          detail: `Fator R live ${fatorR}% · banda ${hubParams.fiscal.fatorRMin}–${hubParams.fiscal.fatorRMax}%.`,
        };
      }
      if (c.id === 'gov-6') {
        return {
          ...c,
          status: tetoOk ? 'passed' : 'warning',
          detail: `RBT12 atual R$ ${rbt12.toLocaleString('pt-BR')} · teto R$ 4,80M.`,
        };
      }
      return c;
    });
  }, [fatorR, hubParams, dreMonths]);

  const addAuditLog = (driver: string, before: string, after: string) => {
    const currentRoleName = USER_ROLES.find((r) => r.id === activeRole)?.name || 'Usuário';
    const isDeprecated = /425|789|804|21,7|387|6\.007|950/i.test(`${driver} ${before} ${after}`);
    const finalDriver = isDeprecated ? `[DEPRECIADO] ${driver}` : driver;

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      user: currentRoleName,
      driver: finalDriver,
      before,
      after,
      timestamp: new Date().toLocaleString('pt-BR'),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const persistJson = async (
    label: string,
    url: string,
    init: RequestInit,
  ): Promise<boolean> => {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
          error?: string;
        };
        const msg = err.error ?? `HTTP ${res.status}`;
        addAuditLog('Persistência', label, msg);
        setBlockedValueAttempt(`Erro ao salvar (${label}): ${msg}`);
        return false;
      }
      return true;
    } catch {
      addAuditLog('Persistência', label, 'Falha de rede');
      setBlockedValueAttempt(`Erro de rede ao salvar (${label}).`);
      return false;
    }
  };

  const updateVasDriver = (id: string, field: 'price' | 'quantityM7_12' | 'quantityM1_6' | 'quantityM13_24', value: number) => {
    // Check deprecated/blocked values check
    if (value === 425000 || value === 789000 || value === 804000) {
      setBlockedValueAttempt(`Operação bloqueada: O valor R$ ${value.toLocaleString('pt-BR')} é um parâmetro legado deprecado. Utilizar a biblioteca de drivers v3.5 auditada.`);
      return;
    }

    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Edição restrita: O perfil '${activeRole}' ou modo Pitch Mode ativo previne edições nas premissas.`);
      return;
    }

    setVasDrivers((prev) =>
      prev.map((driver) => {
        if (driver.id === id) {
          const oldVal = driver[field];
          const updated = { ...driver, [field]: value };
          // recalculate revenue estimation
          updated.revenue = Math.round(updated.price * (updated.quantityM1_6 * 6 + updated.quantityM7_12 * 6 + updated.quantityM13_24 * 12) / 24);
          addAuditLog(
            `Driver ${driver.service} (${field})`,
            `${oldVal}`,
            `${value}`
          );
          return updated;
        }
        return driver;
      })
    );
  };

  const updateDreValue = (monthIndex: number, field: keyof DreMonth, value: number) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Edição bloqueada no perfil atual (${activeRole}). Apenas CFO e Sócios podem editar premissas.`);
      return;
    }
    // Update DRE month value
  };

  const applyFatorRTrigger = () => {
    const currentMonth = dreMonths?.[dreMonths.length - 1]?.month || 1;
    const ajuste = plAdditionalForMonth(hubParams, currentMonth);
    const base = hubParams.fiscal.plBaseMonthly;
    const novoProLabore = base + ajuste;

    setProlaboreMonthly(novoProLabore);
    addAuditLog(
      'Gatilho Fator R',
      `M${currentMonth}`,
      `PL Total: R$ ${novoProLabore.toLocaleString('pt-BR')} (Base ${base.toLocaleString('pt-BR')} + Adic. ${ajuste.toLocaleString('pt-BR')})`,
    );
  };

  const openInspector = (cellInfo: InspectorCellInfo) => {
    setInspectorCell(cellInfo);
  };

  const closeInspector = () => {
    setInspectorCell(null);
  };

  const clearBlockedAttempt = () => {
    setBlockedValueAttempt(null);
  };

  const duplicateScenario = (scenarioId: string) => {
    const target = scenarios.find((s) => s.id === scenarioId);
    if (!target) return;
    const newId = `sc-${Date.now()}`;
    const newScen: Scenario = {
      ...target,
      id: newId,
      name: `${target.name} (Cópia)`,
      isBaseline: false,
    };
    setScenarios((prev) => [...prev, newScen]);
    setActiveScenarioId(newId);
    addAuditLog('Gestão de Cenários', '-', `Duplicado cenário '${target.name}'`);
  };

  const createNewScenario = (name: string, occupancy: number) => {
    const newId = `sc-${Date.now()}`;
    const baseline = hubParams.ramp.baselineOccupancy || 0.75;
    const scale = occupancy / baseline;
    const llM7 = dreMonths.find((m) => m.month === 7)?.lucroLiquido;
    const newScen: Scenario = {
      id: newId,
      name,
      isBaseline: false,
      drivers: {
        occupancyRate: occupancy,
        rentFactor: 1,
        cogsVariableFactor: 1,
        hcOpexFactor: 1,
        techOpexActive: false,
      },
      occupancyRate: occupancy,
      llM7Plus: Math.round((llM7 ?? 14_279) * scale),
      capexTotal: hubParams.capex.total,
      m24Cash: Math.round(OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel * scale),
      fatorR: Number((hubParams.fiscal.fatorRFloor * (baseline / occupancy)).toFixed(1)),
      status: occupancy < 0.5 ? 'critical' : 'ok',
      notes: 'Cenário customizado adicionado pelo usuário.',
    };
    setScenarios((prev) => [...prev, newScen]);
    setActiveScenarioId(newId);
    addAuditLog('Gestão de Cenários', '-', `Criado novo cenário '${name}' (${occupancy * 100}% ocupação)`);
  };

  const addDreGranularItem = (item: Omit<DreGranularItem, 'id'>) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Edição bloqueada no perfil atual (${activeRole}). Apenas CFO e Sócios podem adicionar itens.`);
      return;
    }
    const account = chartOfAccounts.find((a) => a.code === item.accountCode);
    if (item.accountCode && !canPostToAccount(account)) {
      setBlockedValueAttempt('Conta sintética não recebe lançamento. Escolha uma conta analítica.');
      return;
    }
    const newItem: DreGranularItem = {
      ...item,
      id: `dre-item-${Date.now()}`,
      manualOverride: true,
    };
    setGranularDreItems((prev) => [...prev, newItem]);
    addAuditLog(`DRE Granular (${newItem.section.toUpperCase()})`, '-', `Criado item '${newItem.name}' (R$ ${newItem.monthlyAmountY1.toLocaleString('pt-BR')}/mês)`);
    scheduleFinancePersist(`ledger:${newItem.id}`, () =>
      persistJson(`ledger ${newItem.name}`, '/api/operator/finance/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      }),
    );
  };

  const updateDreGranularItem = (id: string, updated: Partial<DreGranularItem>) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Edição bloqueada no perfil atual (${activeRole}). Apenas CFO e Sócios podem alterar itens.`);
      return;
    }
    const current = granularDreItems.find((i) => i.id === id);
    if (current && isLedgerItemLocked(current)) {
      setBlockedValueAttempt('Linha CLIA está travada pelo engine. Não é possível editar.');
      return;
    }
    if (updated.accountCode) {
      const account = chartOfAccounts.find((a) => a.code === updated.accountCode);
      if (!canPostToAccount(account)) {
        setBlockedValueAttempt('Conta sintética não recebe lançamento. Escolha uma conta analítica.');
        return;
      }
    }
    setGranularDreItems((prev) => {
      const exists = prev.some((item) => item.id === id);
      if (!exists) {
        const injected = derivedGranularDreItems.find((item) => item.id === id);
        if (!injected) return prev;
        const newItem = { ...injected, ...updated, engineLocked: false, manualOverride: true };
        addAuditLog(`DRE Granular (${newItem.name})`, 'Alteração', `Atualizado R$ ${newItem.monthlyAmountY1.toLocaleString('pt-BR')}/mês Y1`);
        scheduleFinancePersist(`ledger:${newItem.id}`, () =>
          persistJson(`ledger ${newItem.name}`, `/api/operator/finance/ledger/${encodeURIComponent(newItem.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
          }),
        );
        return [...prev, newItem];
      }
      return prev.map((item) => {
        if (item.id === id) {
          const newItem = { ...item, ...updated, engineLocked: false, manualOverride: true };
          addAuditLog(`DRE Granular (${item.name})`, 'Alteração', `Atualizado R$ ${newItem.monthlyAmountY1.toLocaleString('pt-BR')}/mês Y1`);
          scheduleFinancePersist(`ledger:${newItem.id}`, () =>
            persistJson(`ledger ${newItem.name}`, `/api/operator/finance/ledger/${encodeURIComponent(newItem.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newItem),
            }),
          );
          return newItem;
        }
        return item;
      });
    });
  };

  const deleteDreGranularItem = (id: string) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Exclusão bloqueada no perfil atual (${activeRole}).`);
      return;
    }
    const target = granularDreItems.find((i) => i.id === id);
    if (!target) return;
    if (isLedgerItemLocked(target)) {
      setBlockedValueAttempt('Linha CLIA está travada pelo engine. Não é possível excluir.');
      return;
    }
    setGranularDreItems((prev) => prev.filter((i) => i.id !== id));
    addAuditLog('DRE Granular', target.name, 'Excluído');
    scheduleFinancePersist(`ledger-del:${id}`, () =>
      persistJson(`delete ledger ${id}`, `/api/operator/finance/ledger/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    );
  };

  const toggleDreGranularItem = (id: string) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Alternância de status bloqueada para perfil ${activeRole}.`);
      return;
    }
    setGranularDreItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = !item.active;
          addAuditLog(`DRE Granular (${item.name})`, item.active ? 'Ativo' : 'Inativo', newStatus ? 'Ativo' : 'Inativo');
          const next = { ...item, active: newStatus };
          scheduleFinancePersist(`ledger:${item.id}`, () =>
            persistJson(`ledger ${item.name}`, `/api/operator/finance/ledger/${encodeURIComponent(item.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            }),
          );
          return next;
        }
        return item;
      })
    );
  };

  const resetDreGranularItems = () => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Restauração bloqueada para perfil ${activeRole}.`);
      return;
    }
    setGranularDreItems(INITIAL_GRANULAR_DRE_ITEMS);
    setChartOfAccounts(PLANO_DE_CONTAS_ITEMS);
    setCostCenters(COST_CENTERS);
    addAuditLog('DRE Granular', '-', 'Restauradas premissas padrão v3.5 do Plano de Negócios');
  };

  const addChartAccount = (account: AccountItem): boolean => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt('Edição do plano de contas bloqueada para o perfil atual.');
      return false;
    }
    if (chartOfAccounts.some((a) => a.code === account.code)) {
      setBlockedValueAttempt(`Já existe a conta ${account.code}.`);
      return false;
    }
    setChartOfAccounts((prev) => [...prev, account]);
    addAuditLog('Plano de contas', '-', `Criada ${account.code} ${account.name}`);
    scheduleFinancePersist(`account:${account.code}`, () =>
      persistJson(`account ${account.code}`, '/api/operator/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      }),
    );
    return true;
  };

  const updateChartAccount = (code: string, patch: Partial<AccountItem>): boolean => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt('Edição do plano de contas bloqueada para o perfil atual.');
      return false;
    }
    setChartOfAccounts((prev) => {
      const next = prev.map((a) => (a.code === code ? { ...a, ...patch, code: a.code } : a));
      const saved = next.find((a) => a.code === code);
      if (saved) {
        scheduleFinancePersist(`account:${code}`, () =>
          persistJson(`account ${code}`, `/api/operator/finance/accounts/${encodeURIComponent(code)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saved),
          }),
        );
      }
      return next;
    });
    addAuditLog('Plano de contas', code, 'Atualizada');
    return true;
  };

  const deleteChartAccount = (code: string): boolean => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt('Exclusão de conta bloqueada para o perfil atual.');
      return false;
    }
    if (isAccountInUse(code, granularDreItems)) {
      setBlockedValueAttempt(`Conta ${code} está em uso no cadastro financeiro. Remova o lançamento antes.`);
      return false;
    }
    setChartOfAccounts((prev) => prev.filter((a) => a.code !== code));
    addAuditLog('Plano de contas', code, 'Excluída');
    scheduleFinancePersist(`account-del:${code}`, () =>
      persistJson(`delete account ${code}`, `/api/operator/finance/accounts/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      }),
    );
    return true;
  };

  const addCostCenterFn = (cc: CostCenter): boolean => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt('Edição de centro de custo bloqueada para o perfil atual.');
      return false;
    }
    if (costCenters.some((c) => c.id === cc.id)) {
      setBlockedValueAttempt(`Já existe o centro ${cc.id}.`);
      return false;
    }
    setCostCenters((prev) => [...prev, cc]);
    addAuditLog('Centro de custo', '-', `Criado ${cc.id} ${cc.name}`);
    scheduleFinancePersist(`cc:${cc.id}`, () =>
      persistJson(`cc ${cc.id}`, '/api/operator/finance/cost-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cc),
      }),
    );
    return true;
  };

  const applyQuoteToDre = (quoteId: string) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Atualização por cotações bloqueada para perfil ${activeRole}.`);
      return;
    }
    const quote = supplierQuotes.find((q) => q.id === quoteId);
    if (!quote) return;

    // Inclui fornecedor no catálogo se ainda não existir
    setSupplierCompanies((prev) => {
      if (prev.some((c) => c.id === quote.supplierId)) return prev;
      const byName = prev.find(
        (c) =>
          c.state === quote.supplierState &&
          c.name.toLowerCase() === quote.supplierName.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase(),
      );
      if (byName) return prev;
      return [
        {
          id: quote.supplierId,
          name: quote.supplierName.replace(/\s*\([^)]*\)\s*$/, '').trim() || quote.supplierName,
          state: quote.supplierState,
          city: quote.supplierState === 'SC' ? 'Itajaí' : quote.supplierState === 'PR' ? 'Curitiba' : 'São Paulo',
          specialty: quote.materialCategory,
          rating: 4.5,
          deliveryLeadTimeDays: 5,
          freightType: quote.shippingCostMonthly === 0 ? 'CIF' : 'FOB',
          paymentTerms: '30/60 dias no boleto',
          icmsTaxRate: quote.supplierState === 'SP' ? 18 : 12,
          contactPhone: '—',
          contactEmail: 'compras@fornecedor.local',
        },
        ...prev,
      ];
    });

    // Set recommended winner flag
    setSupplierQuotes((prev) =>
      prev.map((q) => ({
        ...q,
        isRecommendedWinner: q.materialCategory === quote.materialCategory ? q.id === quoteId : q.isRecommendedWinner,
      }))
    );

    // Sync values into granular DRE
    if (quote.materialCategory === 'Filme Stretch') {
      const targetItem = granularDreItems.find((i) => i.id === 'cst-3');
      if (targetItem) {
        updateDreGranularItem('cst-3', {
          monthlyAmountY1: quote.totalMonthlyWithFreight,
          monthlyAmountY2: Math.round(quote.totalMonthlyWithFreight * 1.3),
          notes: `Valor sincronizado do fornecedor ${quote.supplierName} (${quote.productDescription})`,
        });
      }
      setMappedVsImplementedCosts((prev) =>
        prev.map((m) =>
          m.id === 'map-1'
            ? { ...m, implementedDreAmountY1: quote.totalMonthlyWithFreight, status: 'otimizado' }
            : m
        )
      );
    } else if (
      quote.materialCategory === 'Paletes PBR HT / Plástico' ||
      quote.materialCategory === 'Paletes PBR HT Madeira' ||
      quote.materialCategory === 'Paletes Plástico PEAD'
    ) {
      setMappedVsImplementedCosts((prev) =>
        prev.map((m) =>
          m.id === 'map-2'
            ? { ...m, implementedDreAmountY1: quote.totalMonthlyWithFreight, status: 'otimizado' }
            : m
        )
      );
    } else if (quote.materialCategory === 'Locação Empilhadeiras') {
      const targetItem = granularDreItems.find((i) => i.id === 'cst-4');
      if (targetItem) {
        updateDreGranularItem('cst-4', {
          monthlyAmountY1: quote.totalMonthlyWithFreight,
          monthlyAmountY2: Math.round(quote.totalMonthlyWithFreight * 1.25),
          notes: `Sincronizado de ${quote.supplierName} - Contrato 24m`,
        });
      }
      setMappedVsImplementedCosts((prev) =>
        prev.map((m) =>
          m.id === 'map-4'
            ? { ...m, implementedDreAmountY1: quote.totalMonthlyWithFreight, status: 'otimizado' }
            : m
        )
      );
    }

    addAuditLog('Assistente de Compras', '-', `Aplicada Cotação Vencedora: ${quote.supplierName} (R$ ${quote.totalMonthlyWithFreight.toLocaleString('pt-BR')}/mês)`);
  };

  const addSupplierQuote = (quote: Omit<SupplierQuote, 'id'>) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Inclusão de cotação bloqueada para perfil ${activeRole}.`);
      return;
    }
    const newQuote: SupplierQuote = {
      ...quote,
      id: `q-custom-${Date.now()}`,
    };
    setSupplierQuotes((prev) => [newQuote, ...prev]);
    addAuditLog('Assistente de Compras', '-', `Nova cotação cadastrada: ${quote.supplierName} (${quote.productDescription})`);
  };

  const ingestComprasFromResearch = (
    parsed: IngestParseResult,
    opts?: { replaceAccountCode?: string; replaceMaterialCategory?: string },
  ) => {
    if (pitchMode || activeRole === 'comite' || activeRole === 'comercial') {
      setBlockedValueAttempt(`Ingestão Deep Research bloqueada para perfil ${activeRole}.`);
      return { companies: 0, quotes: 0 };
    }
    const draft = parsed.compras;
    if (!draft) throw new Error('Pacote sem fornecedores/cotações.');

    const idMap = new Map<string, string>();
    const nextCompanies = [...supplierCompanies];
    for (const incoming of draft.companies) {
      const idx = nextCompanies.findIndex(
        (c) => c.state === incoming.state && c.name.toLowerCase() === incoming.name.toLowerCase(),
      );
      if (idx >= 0) {
        const keptId = nextCompanies[idx].id;
        const prev = nextCompanies[idx];
        idMap.set(incoming.id, keptId);
        nextCompanies[idx] = {
          ...prev,
          ...incoming,
          id: keptId,
          // Ingest sem e-mail não apaga cadastro já preenchido
          contactEmail: incoming.contactEmail?.trim() || prev.contactEmail,
          contactPhone: incoming.contactPhone?.trim() || prev.contactPhone,
        };
      } else {
        idMap.set(incoming.id, incoming.id);
        nextCompanies.push(incoming);
      }
    }
    setSupplierCompanies(nextCompanies);

    const replaceCode = opts?.replaceAccountCode?.trim();
    const replaceCat = opts?.replaceMaterialCategory?.trim();
    let nextQuotes = [...supplierQuotes];
    if (replaceCode) {
      nextQuotes = nextQuotes.filter((q) => q.accountCode !== replaceCode);
    } else if (replaceCat) {
      nextQuotes = nextQuotes.filter((q) => q.materialCategory !== replaceCat);
    }
    for (const incoming of draft.quotes) {
      const supplierId = idMap.get(incoming.supplierId) || incoming.supplierId;
      const quote = {
        ...incoming,
        supplierId,
        accountCode: incoming.accountCode || replaceCode || undefined,
      };
      const idx = nextQuotes.findIndex(
        (q) =>
          q.supplierId === supplierId &&
          q.productDescription.toLowerCase() === quote.productDescription.toLowerCase(),
      );
      if (idx >= 0) {
        nextQuotes[idx] = { ...nextQuotes[idx], ...quote, id: nextQuotes[idx].id };
      } else {
        nextQuotes = [quote, ...nextQuotes];
      }
    }
    if (draft.quotes.some((q) => q.isRecommendedWinner)) {
      const winByCat = new Map(
        draft.quotes
          .filter((q) => q.isRecommendedWinner)
          .map((q) => [q.materialCategory, q] as const),
      );
      nextQuotes = nextQuotes.map((q) => {
        const win = winByCat.get(q.materialCategory);
        if (!win) return q;
        const winId = idMap.get(win.supplierId) || win.supplierId;
        return {
          ...q,
          isRecommendedWinner:
            q.supplierId === winId &&
            q.productDescription.toLowerCase() === win.productDescription.toLowerCase(),
        };
      });
    }
    setSupplierQuotes(nextQuotes);

    addAuditLog(
      'Ingestão Deep Research',
      '-',
      `${draft.companies.length} fornecedor(es) · ${draft.quotes.length} cotação(ões)`,
    );
    return { companies: draft.companies.length, quotes: draft.quotes.length };
  };

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated,
    login,
    logout,
    activeRole,
    setActiveRole,
    pitchMode,
    setPitchMode,
    scenarios,
    scenariosSource,
    financeSource,
    activeScenarioId,
    setActiveScenarioId,
    activeScenario,
    updateScenarioDrivers,
    vasDrivers,
    updateVasDriver,
    dreMonths,
    updateDreValue,
    ledgerBaseItems: granularDreItems,
    granularDreItems: derivedGranularDreItems,
    addDreGranularItem,
    updateDreGranularItem,
    deleteDreGranularItem,
    toggleDreGranularItem,
    resetDreGranularItems,
    mappedVsImplementedCosts,
    supplierCompanies,
    supplierQuotes,
    applyQuoteToDre,
    addSupplierQuote,
    ingestComprasFromResearch,
    fatorR,
    setProlaboreMonthly,
    prolaboreMonthly,
    fatorRTargetBand: [hubParams.fiscal.fatorRMin, hubParams.fiscal.fatorRMax] as [number, number],
    applyFatorRTrigger,
    spinOffActive,
    setSpinOffActive,
    inspectorCell,
    openInspector,
    closeInspector,
    auditLogs,
    governanceChecks,
    addAuditLog,
    activeModule,
    setActiveModule,
    blockedValueAttempt,
    clearBlockedAttempt,
    duplicateScenario,
    createNewScenario,
    activeMix,
    updateActiveMix,
    applyMixToGlobalModel,
    hubParams,
    setHubParams,
    cliaSpineMonthly,
    chartOfAccounts,
    costCenters,
    addChartAccount,
    updateChartAccount,
    deleteChartAccount,
    addCostCenter: addCostCenterFn,
  }), [
    user,
    isAuthenticated,
    activeRole,
    pitchMode,
    scenarios,
    scenariosSource,
    financeSource,
    activeScenarioId,
    activeScenario,
    updateScenarioDrivers,
    vasDrivers,
    dreMonths,
    occupancyDreItems,
    derivedGranularDreItems,
    mappedVsImplementedCosts,
    supplierCompanies,
    supplierQuotes,
    fatorR,
    prolaboreMonthly,
    spinOffActive,
    inspectorCell,
    auditLogs,
    governanceChecks,
    activeModule,
    blockedValueAttempt,
    activeMix,
    hubParams,
    chartOfAccounts,
    costCenters,
  ]);

  return (
    <PlannerContext.Provider value={contextValue}>
      {children}
    </PlannerContext.Provider>
  );
};

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return context;
};
