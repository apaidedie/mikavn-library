import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function PageShell({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('h-full overflow-auto bg-[radial-gradient(circle_at_22%_-8%,rgb(var(--accent-rgb)/0.10),transparent_34%),linear-gradient(180deg,rgb(var(--app-bg-rgb)/0.76),rgb(var(--app-bg-rgb))_42%)] px-6 py-5', className)} {...props}>
      {children}
    </div>
  );
}

export function PageFrame({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('animate-view-in mx-auto flex max-w-[82rem] flex-col gap-4', className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-10 flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-slate-100">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('motion-panel overflow-hidden rounded-lg border border-white/10 bg-[rgb(var(--panel-rgb)/0.22)] backdrop-blur-xl', className)} {...props}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, description, icon, actions, className }: { title: string; description?: string; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-10 items-center justify-between gap-3 border-b border-white/10 bg-black/[0.055] px-3.5 py-2', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          {icon && <span className="text-[rgb(var(--accent-rgb))]">{icon}</span>}
          <span className="truncate">{title}</span>
        </div>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

export function PanelContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-3.5', className)} {...props}>
      {children}
    </div>
  );
}

export function MetricTile({ label, value, detail, icon, className }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('motion-soft-row rounded-lg border border-white/10 bg-black/[0.10] px-3 py-2.5 shadow-inner shadow-white/[0.01]', className)}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon && <span className="text-[rgb(var(--accent-rgb))]">{icon}</span>}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
      {detail && <div className="text-xs text-slate-500">{detail}</div>}
    </div>
  );
}

export const SoftRow = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function SoftRow({ className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn('motion-soft-row rounded-lg border border-white/10 bg-black/[0.10] p-3 shadow-inner shadow-white/[0.01] hover:border-[rgb(var(--accent-rgb)/0.24)] hover:bg-white/[0.045]', className)} {...props}>
      {children}
    </div>
  );
});
