import { Archive, BarChart3, DatabaseZap, FolderSearch, Home, Layers3, LibraryBig, ListTodo, SearchCheck, Settings, Wrench } from 'lucide-react';

export type View = 'dashboard' | 'library' | 'collections' | 'advanced-search' | 'scanner' | 'metadata' | 'tasks' | 'reports' | 'saves' | 'maintenance' | 'settings';

export const navItems = [
  { id: 'dashboard', label: '首页', icon: Home },
  { id: 'library', label: '游戏库', icon: LibraryBig },
  { id: 'collections', label: '合集', icon: Layers3 },
  { id: 'advanced-search', label: '高级搜索', icon: SearchCheck },
  { id: 'scanner', label: '扫描入库', icon: FolderSearch },
  { id: 'metadata', label: '批量匹配', icon: DatabaseZap },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'reports', label: '报告', icon: BarChart3 },
  { id: 'saves', label: '存档', icon: Archive },
  { id: 'maintenance', label: '维护', icon: Wrench },
  { id: 'settings', label: '设置', icon: Settings },
] satisfies Array<{ id: View; label: string; icon: typeof Home }>;

export const primaryNavItems = navItems.filter((item) => item.id !== 'settings');

const validViewIds = new Set<View>(navItems.map((item) => item.id));

export function readInitialView(): View {
  if (typeof window === 'undefined') return 'dashboard';
  const saved = window.localStorage.getItem('mikavn.currentView');
  return saved && validViewIds.has(saved as View) ? saved as View : 'dashboard';
}
