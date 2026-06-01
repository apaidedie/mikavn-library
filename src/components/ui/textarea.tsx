import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full resize-y rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 hover:border-white/15 focus:border-[rgb(var(--accent-rgb)/0.7)] focus:ring-2 focus:ring-[rgb(var(--accent-rgb)/0.15)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
