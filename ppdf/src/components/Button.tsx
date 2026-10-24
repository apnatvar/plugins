import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes } from 'react';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const buttonStyles = cva('inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45', {
  variants: {
    variant: {
      primary: 'bg-[var(--teal)] text-white hover:bg-[var(--teal-hover)]',
      secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      subtle: 'bg-[var(--teal-light)] text-[var(--teal)] hover:bg-[var(--teal-border)]',
      danger: 'text-rose-600 hover:bg-rose-50',
    },
    size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', icon: 'size-9 p-0', wide: 'h-12 px-5' },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
