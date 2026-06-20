import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function ConfigSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('motion-panel overflow-hidden rounded-lg border border-white/10 bg-[rgb(var(--panel-rgb)/0.22)] backdrop-blur-xl', className)}>
      <div className="border-b border-white/10 bg-black/[0.055] px-3.5 py-2 text-sm font-semibold text-slate-100">{title}</div>
      <div className="divide-y divide-white/10">{children}</div>
    </section>
  );
}

export function ConfigItem({ title, description, children, className, id }: { title: string; description?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('motion-soft-row flex flex-col gap-3 border-0 px-3.5 py-2.5 shadow-none hover:bg-white/[0.032] sm:flex-row sm:items-center sm:justify-between sm:gap-5', className)} id={id}>
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium leading-none text-slate-100">{title}</div>
        {description && <div className="max-w-2xl text-xs leading-5 text-slate-500">{description}</div>}
      </div>
      <div className="shrink-0 self-start sm:self-center">{children}</div>
    </div>
  );
}
