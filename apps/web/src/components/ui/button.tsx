import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/* Corners are near-square throughout: this is a drafting surface, not a pill. */
const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-[2px] font-medium ' +
    'whitespace-nowrap select-none transition-colors ' +
    'disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:brightness-110',
        quiet: 'border border-rule bg-surface text-ink hover:border-rule-strong hover:bg-surface-2',
        ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger: 'border border-rule bg-surface text-danger hover:bg-surface-2',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'quiet', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  children?: ReactNode;
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
