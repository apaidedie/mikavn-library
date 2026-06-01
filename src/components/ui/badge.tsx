import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-5 items-center rounded-md border border-white/10 bg-white/[0.045] px-2 text-[11px] leading-5 text-slate-300 shadow-sm shadow-black/10 backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}
