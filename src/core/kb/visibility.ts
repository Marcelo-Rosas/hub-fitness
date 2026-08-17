import type { UserRole } from '../../types';
import type { ModuleId } from '../rbac/moduleVisibility';
import { canViewModule } from '../rbac/moduleVisibility';
import { KB_ARTICLES } from '../../data/knowledgeBase';
import type { KbArticle } from '../../data/knowledgeBase/types';

export function articleById(id: string): KbArticle | undefined {
  return KB_ARTICLES.find((a) => a.id === id);
}

export function visibleArticles(role: UserRole): KbArticle[] {
  return KB_ARTICLES.filter((a) => !a.stub && canViewModule(role, a.moduleId));
}

export function moduleHasKb(role: UserRole, moduleId: ModuleId): boolean {
  return visibleArticles(role).some((a) => a.moduleId === moduleId);
}

export function kbHrefForModule(role: UserRole, moduleId: ModuleId): string | null {
  const arts = visibleArticles(role).filter((a) => a.moduleId === moduleId);
  if (arts.length === 0) return null;
  if (arts.length === 1) return `?module=KB&article=${arts[0].id}`;
  return `?module=KB&group=${moduleId}`;
}
