import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 rounded-md border border-white/10 bg-black/[0.16] px-3 text-sm text-slate-100 outline-none transition-colors hover:border-white/15 focus:border-[rgb(var(--accent-rgb)/0.65)] focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.12)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
