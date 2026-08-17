import React, { useMemo, useState } from 'react';
import { BookOpen, HelpCircle } from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { articleById, visibleArticles } from '../../core/kb/visibility';
import type { KbArticle } from '../../data/knowledgeBase/types';

function groupArticles(articles: KbArticle[]): Record<string, KbArticle[]> {
  const out: Record<string, KbArticle[]> = {};
  for (const a of articles) {
    (out[a.moduleId] ??= []).push(a);
  }
  return out;
}

export const KnowledgeBasePage: React.FC = () => {
  const { activeRole, setActiveModule } = usePlanner();
  const [search, setSearch] = useState(() => window.location.search);

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const articleId = params.get('article');
  const group = params.get('group');
  const articles = visibleArticles(activeRole);
  const current = articleId ? articleById(articleId) : undefined;
  const visibleCurrent = current && articles.some((a) => a.id === current.id) ? current : undefined;
  const hiddenRequested = Boolean(articleId && current && !visibleCurrent);
  const missingRequested = Boolean(articleId && !current);

  const grouped = useMemo(() => {
    const all = groupArticles(articles);
    if (group && all[group]) return { [group]: all[group] };
    return all;
  }, [articles, group]);

  const openArticle = (id: string) => {
    const href = `?module=KB&article=${id}`;
    window.history.replaceState(null, '', href);
    setSearch(href);
    setActiveModule('KB');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <nav className="lg:w-72 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <h1 className="text-sm font-black text-slate-900">Base de conhecimento</h1>
        </div>
        {articles.length === 0 && (
          <p className="text-xs text-slate-500">Nenhum artigo visível para este perfil.</p>
        )}
        {Object.entries(grouped).map(([moduleId, list]) => (
          <div key={moduleId} className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{moduleId}</div>
            {list.map((a) => {
              const active = visibleCurrent?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openArticle(a.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {a.title}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <article className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        {hiddenRequested || missingRequested ? (
          <p className="text-sm font-semibold text-rose-800">
            Artigo indisponível para este perfil.
          </p>
        ) : visibleCurrent ? (
          <>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              <BookOpen className="w-3.5 h-3.5" />
              {visibleCurrent.moduleId}
            </div>
            <h1 className="text-2xl font-black text-slate-900">{visibleCurrent.title}</h1>
            {visibleCurrent.sections.map((s) => (
              <section key={s.heading} className="space-y-2">
                <h2 className="text-sm font-bold text-slate-900">{s.heading}</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{s.body}</p>
              </section>
            ))}
            {visibleCurrent.sources.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-xs text-indigo-800">
                {visibleCurrent.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600">Selecione um artigo.</p>
        )}
      </article>
    </div>
  );
};
