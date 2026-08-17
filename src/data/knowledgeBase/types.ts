import type { ModuleId } from '../../core/rbac/moduleVisibility';

export type KbSource = { label: string; url: string };

export type KbArticle = {
  id: string;
  moduleId: ModuleId;
  title: string;
  stub: boolean;
  sections: { heading: string; body: string }[];
  sources: KbSource[];
};
