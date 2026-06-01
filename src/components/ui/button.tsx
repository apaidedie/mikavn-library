import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'motion-button inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-rgb)/0.55)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[rgb(var(--accent-rgb))] text-[var(--accent-contrast)] hover:brightness-110',
        secondary: 'border border-white/10 bg-white/[0.065] text-slate-100 hover:border-[rgb(var(--accent-rgb)/0.26)] hover:bg-white/[0.10]',
        ghost: 'text-slate-300 shadow-none hover:bg-white/[0.08] hover:text-slate-100',
        danger: 'bg-rose-500 text-white hover:bg-rose-400 hover:shadow-rose-500/20',
        outline: 'border border-white/[0.12] bg-black/[0.12] text-slate-100 hover:border-[rgb(var(--accent-rgb)/0.28)] hover:bg-white/[0.07]',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3',
        lg: 'h-10 px-4',
        icon: 'h-8 w-8 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
