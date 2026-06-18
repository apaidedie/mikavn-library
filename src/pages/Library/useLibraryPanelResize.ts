import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const defaultLibraryPanelWidth = 270;
const minLibraryPanelWidth = 220;
const maxLibraryPanelWidth = 400;

function clampLibraryPanelWidth(value: number) {
  return Math.max(minLibraryPanelWidth, Math.min(maxLibraryPanelWidth, value));
}

export function useLibraryPanelResize() {
  const dragStartRef = useRef({ x: 0, width: defaultLibraryPanelWidth });
  const [libraryPanelWidth, setLibraryPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultLibraryPanelWidth;
    const saved = Number(window.localStorage.getItem('mikavn.libraryPanelWidth'));
    return Number.isFinite(saved) ? clampLibraryPanelWidth(saved) : defaultLibraryPanelWidth;
  });
  const [draggingPanel, setDraggingPanel] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mikavn.libraryPanelWidth', String(libraryPanelWidth));
    }
  }, [libraryPanelWidth]);

  useEffect(() => {
    if (!draggingPanel) return;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (event: PointerEvent) => {
      const delta = event.clientX - dragStartRef.current.x;
      setLibraryPanelWidth(clampLibraryPanelWidth(dragStartRef.current.width + delta));
    };

    const onPointerUp = () => {
      setDraggingPanel(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [draggingPanel]);

  const resetLibraryPanelWidth = useCallback(() => {
    setLibraryPanelWidth(defaultLibraryPanelWidth);
  }, []);

  const startPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartRef.current = { x: event.clientX, width: libraryPanelWidth };
    setDraggingPanel(true);
  }, [libraryPanelWidth]);

  return {
    draggingPanel,
    libraryPanelWidth,
    resetLibraryPanelWidth,
    startPanelResize,
  };
}
