import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Wand2, Save } from 'lucide-react';
import {
  buildWranglerSecretCommand,
  generateOperatorToken,
  getComexOperatorToken,
  setComexOperatorToken,
} from './comexOperatorToken';

interface ComexOperatorTokenPanelProps {
  onSaved: () => void;
  configuredOnServer: boolean;
}

export const ComexOperatorTokenPanel: React.FC<ComexOperatorTokenPanelProps> = ({
  onSaved,
  configuredOnServer,
}) => {
  const [token, setToken] = useState(getComexOperatorToken);
  const [visible, setVisible] = useState(false);
  const [command, setCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    const clean = token.trim();
    if (!clean) return;
    setComexOperatorToken(clean);
    const cmd = buildWranglerSecretCommand(clean);
    setCommand(cmd);
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    onSaved();
  };

  return (
    <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-5 space-y-4 max-w-2xl">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            Token de operador Comex
          </h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            As rotas do Comex exigem o token de operador. Ele fica guardado só nesta aba do navegador.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="COMEX_OPERATOR_TOKEN"
          className="flex-1 min-w-[16rem] px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="p-2 rounded-lg border border-slate-300 text-slate-600 cursor-pointer"
          aria-label={visible ? 'Ocultar token' : 'Mostrar token'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setToken(generateOperatorToken())}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-300 text-teal-800 text-xs font-bold cursor-pointer"
        >
          <Wand2 className="w-4 h-4" /> Gerar
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!token.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" /> Salvar
        </button>
      </div>

      {command && (
        <div className="space-y-2">
          <p className="text-xs text-slate-700">
            {copied ? 'Comando copiado. ' : 'Copie o comando abaixo. '}
            Rode no PowerShell para gravar o secret no servidor — cole só o comando, sem o{' '}
            <span className="font-mono">PS C:\&gt;</span> da frente.
          </p>
          <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono whitespace-pre-wrap break-all">
            {command}
          </pre>
        </div>
      )}

      {!configuredOnServer && (
        <p className="text-xs text-amber-700">
          O servidor ainda não tem <span className="font-mono">COMEX_OPERATOR_TOKEN</span>. Depois de rodar o
          comando, reinicie/deploy e recarregue.
        </p>
      )}
    </div>
  );
};
