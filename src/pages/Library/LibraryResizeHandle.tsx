import type { PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/utils/cn';

type LibraryResizeHandleProps = {
  dragging: boolean;
  onReset: () => void;
  onStartResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function LibraryResizeHandle({ dragging, onReset, onStartResize }: LibraryResizeHandleProps) {
  return (
    <div
      aria-label="调整游戏库侧栏宽度"
      className={cn('library-resizer group relative z-10 h-full w-1 shrink-0 cursor-ew-resize', dragging && 'is-dragging')}
      onDoubleClick={onReset}
      onPointerDown={onStartResize}
      role="separator"
    >
      <div className="absolute inset-y-0 left-0 w-px bg-white/10 transition-all duration-100 group-hover:w-1 group-hover:bg-[rgb(var(--accent-rgb)/0.72)]" />
    </div>
  );
}
