import React, { useEffect, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  FileText,
  Building2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Scale,
  Sparkles,
  Printer,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';

type OperatorContract = {
  id: string;
  code: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  currency: string;
  client_slug?: string | null;
  client_trade_name?: string | null;
  is_dogfood?: boolean | null;
};

export const M12ContratosSla: React.FC = () => {
  const { activeRole, pitchMode, activeScenario, addAuditLog } = usePlanner();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [operatorContracts, setOperatorContracts] = useState<OperatorContract[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [contractsEmpty, setContractsEmpty] = useState(true);

  // SLA Operational Status State
  const [b2cCutoffHour, setB2cCutoffHour] = useState<number>(11); // Target <= 11h
  const [b2bCutoffHour, setB2bCutoffHour] = useState<number>(12); // Target <= 12h
  const [reverseSlaHours, setReverseSlaHours] = useState<number>(24); // Target <= 24h

  // Technical Loss / Quebra Técnica State
  const [clientNfValue, setClientNfValue] = useState<number>(150000); // R$ 150k
  const [clientSimulatedLoss, setClientSimulatedLoss] = useState<number>(1800); // R$ 1.800

  // Right of Retention Toggle (Art. 644 CC)
  const [retentionActive, setRetentionActive] = useState<boolean>(false);
  const [overdueInvoicesAmount, setOverdueInvoicesAmount] = useState<number>(42500);

  // KONNEN Checklist State
  const [konnenChecklist, setKonnenChecklist] = useState({
    artEmitted: true,
    maxLoadVerified: true,
    impactSensors: true,
    insuranceActive: true,
  });

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/operator/contracts')
      .then((r) => r.json())
      .then((json: { success?: boolean; contracts?: OperatorContract[]; empty?: boolean }) => {
        if (cancelled) return;
        setContractsLoaded(true);
        const rows = Array.isArray(json?.contracts) ? json.contracts : [];
        // Comercial: não listar dogfood como contrato pitch
        const commercial = rows.filter((c) => !c.is_dogfood);
        setOperatorContracts(commercial);
        setContractsEmpty(commercial.length === 0);
      })
      .catch(() => {
        if (cancelled) return;
        setContractsLoaded(true);
        setOperatorContracts([]);
        setContractsEmpty(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const calculatedLossPercent = clientNfValue > 0 ? (clientSimulatedLoss / clientNfValue) * 100 : 0;
  const isLossBlocked = calculatedLossPercent >= 1.0; // 1% threshold from BP v3.5

  const toggleChecklistItem = (key: keyof typeof konnenChecklist) => {
    if (pitchMode) {
      alert('🔒 PITCH MODE ATIVO: Não é possível alterar itens de governança durante a apresentação.');
      return;
    }
    setKonnenChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allKonnenPassed = Object.values(konnenChecklist).every(Boolean);

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M12"
        title="Gestão de Contratos, SLA Operacional & Blindagem Jurídica"
        subtitle="Mitigação de risco contratual com travas automatizadas de corte B2C/B2B, limite de quebra técnica (1%), direito de retenção de carga (Art. 644 CC) e checklist estrutural KONNEN."
        kpis={[
          {
            label: 'Limite Quebra Técnica',
            value: `${calculatedLossPercent.toFixed(2)}%`,
            subtext: isLossBlocked ? '⚠️ Excede limite contratual de 1%' : '✓ Dentro do limite (1,0%)',
            badge: 'TOLERÂNCIA',
            highlightColor: isLossBlocked ? 'rose' : 'emerald',
          },
          {
            label: 'Direito de Retenção (Art 644)',
            value: retentionActive ? 'ATIVADO' : 'INATIVO',
            subtext: retentionActive ? `Inadimplência R$ ${overdueInvoicesAmount.toLocaleString('pt-BR')}` : 'Sem ocorrência de retenção',
            badge: 'JURÍDICO',
            highlightColor: retentionActive ? 'amber' : 'slate',
          },
          {
            label: 'Checklist KONNEN Galpão',
            value: allKonnenPassed ? '100% CONFORME' : 'PENDENTE',
            subtext: allKonnenPassed ? '✓ ART e Segurança Aprovadas' : '⚠️ Requer ação de campo',
            badge: 'ESTRUTURA',
            highlightColor: allKonnenPassed ? 'emerald' : 'amber',
          },
          {
            label: 'Contratos Operator',
            value: contractsLoaded ? String(operatorContracts.length) : '…',
            subtext: contractsEmpty ? 'Nenhum contrato no Operator' : 'Fonte: public.contracts',
            badge: 'OPERATOR',
            highlightColor: contractsEmpty ? 'slate' : 'indigo',
          },
        ]}
      />

      {/* Operator contracts — read-only; empty = sem inventar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <FileText className="w-5 h-5 text-blue-900" />
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Contratos comerciais (Operator)
            </h3>
            <p className="text-[11px] text-slate-500">
              Leitura de <code className="font-mono">public.contracts</code> — sem seed inventado na UI
            </p>
          </div>
        </div>
        {!contractsLoaded && (
          <p className="text-xs text-slate-500">Carregando contratos…</p>
        )}
        {contractsLoaded && operatorContracts.length === 0 && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            Nenhum contrato ativo no Operator. Cadastre em <code className="font-mono">public.contracts</code> (ou via Control Tower) — o painel de SLA abaixo continua operacional com defaults de simulação.
          </p>
        )}
        {operatorContracts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Código</th>
                  <th className="py-2 pr-3 font-semibold">Cliente</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Início</th>
                  <th className="py-2 font-semibold">Fim</th>
                </tr>
              </thead>
              <tbody>
                {operatorContracts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 text-slate-800">
                    <td className="py-2 pr-3 font-mono font-bold">{c.code}</td>
                    <td className="py-2 pr-3">{c.client_trade_name || c.client_slug || '—'}</td>
                    <td className="py-2 pr-3 uppercase font-semibold">{c.status}</td>
                    <td className="py-2 pr-3 font-mono">{c.starts_on}</td>
                    <td className="py-2 font-mono">{c.ends_on || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 1: SLA MONITORING PANEL */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-900" />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                1. Painel de Monitoramento de SLAs Operacionais
              </h3>
              <p className="text-[11px] text-slate-500">
                Parâmetros rigorosos de expedição B2C/B2B e tempo de processamento de devolução reversa
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
            BP v3.5 · Seção 9
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card SLA 1: Corte B2C */}
          <div className={`p-4 rounded-xl border transition-all ${
            b2cCutoffHour > 11
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Corte B2C (Picking/Pack)</span>
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${
                b2cCutoffHour > 11 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {b2cCutoffHour > 11 ? 'ALERTA DE ATRASO' : 'SLA COMPLIANT'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black font-mono">{b2cCutoffHour}:00h</span>
              <span className="text-xs text-slate-500 font-medium">(Alvo BP: ≤ 11:00h)</span>
            </div>

            <p className="text-[11px] leading-snug mb-3">
              Pedidos B2C confirmados até as 11:00h são despachados no mesmo dia. Atrasos geram multa contratual de 2% sobre o frete.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-600 block">Simular Horário de Pedido B2C:</label>
              <input
                type="range"
                min="8"
                max="16"
                value={b2cCutoffHour}
                onChange={(e) => setB2cCutoffHour(Number(e.target.value))}
                className="w-full accent-blue-900"
              />
            </div>
          </div>

          {/* Card SLA 2: Corte B2B */}
          <div className={`p-4 rounded-xl border transition-all ${
            b2bCutoffHour > 12
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Corte B2B (LTL / Paletizado)</span>
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${
                b2bCutoffHour > 12 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {b2bCutoffHour > 12 ? 'ALERTA B2B' : 'SLA COMPLIANT'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black font-mono">{b2bCutoffHour}:00h</span>
              <span className="text-xs text-slate-500 font-medium">(Alvo BP: ≤ 12:00h)</span>
            </div>

            <p className="text-[11px] leading-snug mb-3">
              Agendamentos de expedição de grandes volumes B2B (Redes de Academias / Franquias) exigem janela até 12:00h.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-600 block">Simular Horário de Pedido B2B:</label>
              <input
                type="range"
                min="9"
                max="17"
                value={b2bCutoffHour}
                onChange={(e) => setB2bCutoffHour(Number(e.target.value))}
                className="w-full accent-blue-900"
              />
            </div>
          </div>

          {/* Card SLA 3: Logística Reversa (Diferencial Moat) */}
          <div className={`p-4 rounded-xl border transition-all ${
            reverseSlaHours > 24
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Logística Reversa (Moat)</span>
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${
                reverseSlaHours > 24 ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {reverseSlaHours > 24 ? '🚨 AMEAÇA AO MOAT (24H)' : 'DIFERENCIAL 24H OK'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black font-mono">{reverseSlaHours} horas</span>
              <span className="text-xs text-slate-500 font-medium">(Mercado: 72h)</span>
            </div>

            <p className="text-[11px] leading-snug mb-3">
              Processamento, triagem e recondicionamento em até 24h. Superar 24h reduz a vantagem competitiva sobre operadores tradicionais.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-600 block">Simular Tempo de Reversa (Horas):</label>
              <input
                type="range"
                min="12"
                max="72"
                step="6"
                value={reverseSlaHours}
                onChange={(e) => setReverseSlaHours(Number(e.target.value))}
                className="w-full accent-blue-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CONTRACTUAL RISK MITIGATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trava de Quebra Técnica (1%) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                2. Trava de Quebra Técnica (Limite 1% NF)
              </h3>
              <p className="text-[11px] text-slate-500">
                Cláusula contratual padrão limitando a responsabilidade do operador a 1% do valor movimentado.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Valor da NF do Cliente (R$):</label>
                <input
                  type="number"
                  value={clientNfValue}
                  onChange={(e) => setClientNfValue(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Avaria / Quebra Simulada (R$):</label>
                <input
                  type="number"
                  value={clientSimulatedLoss}
                  onChange={(e) => setClientSimulatedLoss(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-slate-900 focus:ring-2 focus:ring-blue-900 outline-none"
                />
              </div>
            </div>

            {/* Calculated Status Box */}
            <div className={`p-4 rounded-xl border ${
              isLossBlocked
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Índice de Avaria Calculado:</span>
                <span className="font-extrabold font-mono text-sm">{calculatedLossPercent.toFixed(2)}%</span>
              </div>

              {isLossBlocked ? (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs uppercase">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>⚠️ TRAVA ATIVADA: LIMITE TÉCNICO DE 1% ULTRAPASSADO</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    A avaria simulada (R$ {clientSimulatedLoss.toLocaleString('pt-BR')}) excede o teto contratual de 1,0% (R$ {(clientNfValue * 0.01).toLocaleString('pt-BR')}). Bloqueio de retenção acionado e convocação da vistoria de sinistro.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Avaria dentro da margem de tolerância operacional (≤ 1,0%).</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Direito de Retenção Legal (Art. 644 CC) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Scale className="w-5 h-5 text-blue-900" />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                3. Direito de Retenção de Carga (Art. 644 CC)
              </h3>
              <p className="text-[11px] text-slate-500">
                Garantia legal de retenção do estoque sob custódia em caso de inadimplência de faturas de armazenagem.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="font-extrabold text-slate-900 block text-xs">Status do Direito de Retenção</span>
                <span className="text-[11px] text-slate-500">Dec. 1.102/1903 & Art. 644 do Código Civil</span>
              </div>

              <button
                onClick={() => setRetentionActive(!retentionActive)}
                className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                  retentionActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                {retentionActive ? <Lock className="w-4 h-4 text-white" /> : <Unlock className="w-4 h-4 text-slate-600" />}
                <span>{retentionActive ? 'CARGA RETIDA (ATIVO)' : 'LIBERADO (NORMAL)'}</span>
              </button>
            </div>

            {retentionActive && (
              <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl space-y-2 animate-in fade-in">
                <div className="font-bold text-rose-950 flex items-center justify-between">
                  <span>Inadimplência Mitigada Protegida:</span>
                  <span className="font-mono text-sm font-extrabold text-rose-800">
                    R$ {overdueInvoicesAmount.toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-[11px] text-rose-900 leading-relaxed">
                  A retenção legal foi notificada via AR. O operador 3PL exerce a posse do lote de paletes no Galpão A até a liquidação integral dos honorários de armazenagem e serviços pendentes.
                </p>
              </div>
            )}

            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-[11px] text-slate-700 space-y-1">
              <strong className="text-blue-900 block font-bold uppercase">Fundamentação Jurídica do BP:</strong>
              <p className="leading-snug">
                "O depositário tem o direito de reter a coisa depositada até que lhe seja pago o líquido da dívida proveniente do depósito e das despesas com a sua conservação." (Art. 644, CC).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: KONNEN RACKING STRUCTURAL VALIDATION */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                4. Checklist Estrutural de Onboarding KONNEN (Porta-Paletes)
              </h3>
              <p className="text-[11px] text-slate-400">
                Garantia de conformidade física e seguro de responsabilidade civil para armazenagem pesada (Até 1.000 kg/par)
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono ${
            allKonnenPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            {allKonnenPassed ? '✓ ESTRUTURA BLINDADA' : '⚠️ PENDÊNCIA TÉCNICA'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div
            onClick={() => toggleChecklistItem('artEmitted')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              konnenChecklist.artEmitted ? 'bg-slate-950 border-emerald-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded shrink-0 mt-0.5 ${konnenChecklist.artEmitted ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-xs mb-0.5">ART de Engenharia Estrutural Emitida</div>
              <p className="text-[11px] text-slate-400">Anotação de Responsabilidade Técnica válida para 2.968 posições KONNEN no Galpão A.</p>
            </div>
          </div>

          <div
            onClick={() => toggleChecklistItem('maxLoadVerified')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              konnenChecklist.maxLoadVerified ? 'bg-slate-950 border-emerald-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded shrink-0 mt-0.5 ${konnenChecklist.maxLoadVerified ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-xs mb-0.5">Teste de Carga Máxima (1.000 kg / par)</div>
              <p className="text-[11px] text-slate-400">Verificação do limite de deflexão e carga concentrada para equipamentos fitness pesados.</p>
            </div>
          </div>

          <div
            onClick={() => toggleChecklistItem('impactSensors')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              konnenChecklist.impactSensors ? 'bg-slate-950 border-emerald-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded shrink-0 mt-0.5 ${konnenChecklist.impactSensors ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-xs mb-0.5">Protetores de Montante & Sensores de Impacto</div>
              <p className="text-[11px] text-slate-400">Barreiras físicas de proteção nos corredores operacionais das empilhadeiras retráteis.</p>
            </div>
          </div>

          <div
            onClick={() => toggleChecklistItem('insuranceActive')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              konnenChecklist.insuranceActive ? 'bg-slate-950 border-emerald-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <div className={`p-1.5 rounded shrink-0 mt-0.5 ${konnenChecklist.insuranceActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-xs mb-0.5">Apólice RCF-DC e RCTR-C Ativa</div>
              <p className="text-[11px] text-slate-400">Cobertura securitária integral contra sinistro, incêndio e desmoronamento de carga sob custódia.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
