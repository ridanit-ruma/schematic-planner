import type { ComponentType, MouseEvent } from 'react';

import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * A button that is only an icon, so its name is a tooltip and its label for a
 * screen reader. Every create button in the explorer is one: words on each row
 * would say "new plan" forty times down the tree.
 */
export function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  side = 'bottom',
  className,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  return (
    <Tooltip content={label} side={side}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-md text-ink-muted transition-colors',
          'hover:bg-surface-3 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          'disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
      >
        <Icon className="size-4" />
      </button>
    </Tooltip>
  );
}
