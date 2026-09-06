import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/*
 * Compact and technical. A primary button carries a 1px top highlight so it
 * reads as a raised key rather than a flat rectangle, and presses in slightly
 * on click — the only motion in the component, and it answers an action.
 */
const button = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium ' +
    'whitespace-nowrap select-none transition-[background-color,border-color,color,transform] ' +
    'duration-100 active:scale-[0.98] ' +
    'disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-ink shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] hover:bg-accent-hover',
        quiet: 'border border-rule bg-surface-2 text-ink hover:border-rule-strong hover:bg-surface-3',
        ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
      },
      size: {
        sm: 'h-6 gap-1 px-2 text-xs',
        md: 'h-8 px-3 text-sm',
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
