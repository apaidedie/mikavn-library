import { useEffect } from 'react';
import { navItems, type View } from './appNavigation';

type UseAppKeyboardShortcutsOptions = {
  focusLibrarySearch: () => void;
  refresh: () => void;
  requestAddGame: () => void;
  setView: (view: View) => void;
};

export function useAppKeyboardShortcuts({ focusLibrarySearch, refresh, requestAddGame, setView }: UseAppKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const editing = isEditingTarget(event.target);
      const navIndex = Number(event.key) - 1;
      if ((event.altKey || event.ctrlKey) && navIndex >= 0 && navIndex < navItems.length) {
        event.preventDefault();
        setView(navItems[navIndex].id);
        return;
      }

      if (!editing && event.key === '/') {
        event.preventDefault();
        focusLibrarySearch();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        focusLibrarySearch();
        return;
      }

      if (!editing && event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        requestAddGame();
        return;
      }

      if (!editing && event.ctrlKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        refresh();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusLibrarySearch, refresh, requestAddGame, setView]);
}

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}
