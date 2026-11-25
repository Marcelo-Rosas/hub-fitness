import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Wand2, Save } from 'lucide-react';
import {
  buildWranglerSecretCommand,
  generateOperatorToken,
  getComexOperatorToken,
  isValidOperatorTokenFormat,
  setComexOperatorToken,
} from './comexOperatorToken';

interface ComexOperatorTokenPanelProps {
  onSaved: () => void;
  configuredOnServer: boolean;
  /** true quando o gateway respondeu 401/503 a um token enviado por este navegador. */
  rejected?: boolean;
  /** Servidor aceita login do Cloudflare Access (COMEX_ALLOWED_EMAILS + Worker). */
  accessConfigured?: boolean;
  /** /status falhou: não se sabe se o Access autoriza. */
  statusUnknown?: boolean;
}

export const ComexOperatorTokenPanel: React.FC<ComexOperatorTokenPanelProps> = ({
  onSaved,
  configuredOnServer,
  rejected = false,
  accessConfigured = false,
  statusUnknown = false,
}) => {
  const [token, setToken] = useState(getComexOperatorToken);
  const [visible, setVisible] = useState(false);
  const [command, setCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const clean = token.trim();
    if (!clean) return;
    if (!isValidOperatorTokenFormat(clean)) {
      setError('Token inválido: use ao menos 16 caracteres, apenas letras, números, "-" e "_". Use o botão Gerar.');
      setCommand(null);
      return;
    }
    setError(null);
    setComexOperatorToken(clean);
    setCommand(buildWranglerSecretCommand());
    try {
      await navigator.clipboard.writeText(clean);
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
            {statusUnknown
              ? 'Não foi possível verificar o acesso no servidor. Use o token de operador para continuar.'
              : accessConfigured
                ? 'Seu login do Cloudflare Access não está autorizado para o Comex. Como alternativa, use o token de operador.'
                : 'Este servidor exige o token de operador para o Comex.'}{' '}
            Ele fica guardado neste navegador por 30 dias (não precisa colar de novo a cada entrada).
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

      {error && <p className="text-xs text-rose-700">{error}</p>}

      {rejected && configuredOnServer && !command && (
        <p className="text-xs text-rose-700 leading-relaxed">
          O servidor recusou o token deste navegador. Cole o token que você gravou no secret (gerenciador de senhas) —
          não clique em Gerar: um token novo só funciona depois de gravar o secret de novo e reiniciar o container.
        </p>
      )}

      {command && (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 leading-relaxed">
            Atenção: gravar ou trocar o secret só vale depois de reiniciar o container (deploy). Sem{' '}
            <span className="font-mono">DATABASE_URL</span>, reiniciar APAGA o SQLite (processos, clientes e
            despachantes). Fixe o token uma vez, antes de cadastrar clientes reais, e ligue o Postgres antes do uso
            real.
          </p>
          <p className="text-xs text-slate-700">
            {copied
              ? 'O token foi copiado para a área de transferência. '
              : 'Não foi possível copiar o token automaticamente — copie-o do campo acima. '}
            Rode o comando abaixo no PowerShell, na raiz do repositório hub-fitness. Ele lê o token da área de
            transferência (o token não aparece no comando). Guarde o token num gerenciador de senhas.
          </p>
          <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono whitespace-pre-wrap break-all">
            {command}
          </pre>
        </div>
      )}

      {!configuredOnServer && (
        <p className="text-xs text-amber-700">
          O servidor ainda não tem <span className="font-mono">COMEX_OPERATOR_TOKEN</span>. Depois de rodar o
          comando, reinicie o container (deploy) e recarregue. Sem <span className="font-mono">DATABASE_URL</span>,
          o reinício apaga os dados do SQLite.
        </p>
      )}
    </div>
  );
};
