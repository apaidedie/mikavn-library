import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 hover:border-white/15 focus:border-[rgb(var(--accent-rgb)/0.65)] focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.12)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
