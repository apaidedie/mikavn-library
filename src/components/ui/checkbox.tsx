import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      className={cn(
        'h-4 w-4 shrink-0 rounded border-white/20 bg-black/20 accent-[rgb(var(--accent-rgb))] outline-none transition focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.55)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      type="checkbox"
      {...props}
    />
  );
}

export function CheckboxField({ label, className, children, ...props }: CheckboxProps & { label: ReactNode }) {
  return (
    <label className={cn('motion-soft-row flex items-center gap-2 rounded-md border border-white/10 bg-black/[0.12] px-3 py-2 text-sm text-slate-300 hover:border-[rgb(var(--accent-rgb)/0.28)] hover:bg-white/[0.055]', className)}>
      <Checkbox {...props} />
      <span className="min-w-0">{label}</span>
      {children}
    </label>
  );
}
