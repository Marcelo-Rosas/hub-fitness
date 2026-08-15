import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
  emptyMessage?: string;
  maxVisible?: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Selecionar…',
  required = false,
  disabled = false,
  allowCustom = false,
  emptyMessage = 'Nenhum resultado. Digite para filtrar.',
  maxVisible = 80,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label || (value ? value : '');

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? options.filter((o) => normalize(`${o.value} ${o.label}`).includes(q))
      : options;
    return list.slice(0, maxVisible);
  }, [options, query, maxVisible]);

  const canUseCustom =
    allowCustom && query.trim() !== '' && !options.some((o) => o.value === query.trim());

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        const estimated = 240;
        const top =
          rect.bottom + estimated > window.innerHeight && rect.top > estimated
            ? Math.max(8, rect.top - estimated)
            : rect.bottom + 4;
        setMenuPos({ top, left: rect.left, width: rect.width });
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" required={required} value={value} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-left flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <span className={`flex-1 truncate ${display ? 'text-slate-800' : 'text-slate-400'}`}>
          {display || placeholder}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div
          className="fixed z-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          <div className="p-2 border-b bg-slate-50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canUseCustom) {
                  e.preventDefault();
                  pick(query.trim());
                } else if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  pick(filtered[0].value);
                }
              }}
              placeholder="Filtrar na lista…"
              className="w-full bg-transparent outline-none text-xs"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {!required && (
              <li>
                <button
                  type="button"
                  onClick={() => pick('')}
                  className="w-full text-left px-3 py-1.5 text-slate-400 hover:bg-slate-50 cursor-pointer"
                >
                  —
                </button>
              </li>
            )}
            {canUseCustom && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(query.trim())}
                  className="w-full text-left px-3 py-1.5 text-teal-800 bg-teal-50 hover:bg-teal-100 cursor-pointer"
                >
                  Usar “{query.trim()}”
                </button>
              </li>
            )}
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => pick(opt.value)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 cursor-pointer ${
                    opt.value === value ? 'bg-teal-50 text-teal-900 font-semibold' : ''
                  }`}
                >
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${opt.value === value ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && !canUseCustom && (
              <li className="px-3 py-2 text-slate-400">{emptyMessage}</li>
            )}
            {options.length > maxVisible && filtered.length >= maxVisible && (
              <li className="px-3 py-1.5 text-[10px] text-slate-400">
                Mostrando {maxVisible} de {options.length} — refine o filtro.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
