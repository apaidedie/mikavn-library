import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type NoticeTone = 'info' | 'error' | 'warning';

const toneClass: Record<NoticeTone, string> = {
  info: 'border-[rgb(var(--accent-rgb)/0.22)] bg-[rgb(var(--accent-rgb)/0.10)] text-slate-100',
  error: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
  warning: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
};

export function Notice({ tone = 'info', className, children, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: NoticeTone; children: ReactNode }) {
  return (
    <div className={cn('rounded-md border px-3 py-2.5 text-sm shadow-sm backdrop-blur', toneClass[tone], className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-dashed border-white/10 bg-black/[0.10] px-4 py-10 text-center text-sm text-slate-500', className)} {...props}>
      {children}
    </div>
  );
}
