export type PlannerRoute = { module: string; article?: string };

export function resolvePlannerSearch(search: string): PlannerRoute {
  const q = search.startsWith('?') ? search.slice(1) : search;
  const p = new URLSearchParams(q);
  const module = p.get('module') || 'M1';
  const tab = p.get('tab');
  const article = p.get('article') || undefined;

  if (module === 'M6') {
    if (tab === 'enquadramento') return { module: 'KB', article: 'm6-enquadramento' };
    if (tab === 'board_memo') return { module: 'KB', article: 'm6-board-memo' };
    if (tab === 'plano_contas') return { module: 'M11' };
    return { module: 'M6' };
  }
  if (module === 'M11') return { module: 'M11' };
  if (module === 'KB') return { module: 'KB', article };
  return { module, article };
}
