import { ToggleGroup as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * One of several, where the choice is small enough to show all of it at once.
 *
 * Written by hand this was a row of buttons carrying aria-pressed, which says
 * "on or off" for each rather than "one of these" for the set. Arrow keys did
 * not move between them either.
 */
export function ToggleGroup<T extends string>({
  value,
  onChange,
  label,
  children,
}: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root
      type="single"
      value={value}
      // Radix reports an empty string when the pressed item is pressed again.
      // There is always a current choice here, so that is not a change.
      onValueChange={(next) => next !== '' && onChange(next as T)}
      aria-label={label}
      className="flex items-center rounded-[2px] border border-rule"
    >
      {children}
    </Primitive.Root>
  );
}

export function ToggleItem({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Item
      value={value}
      aria-label={label}
      className={cn(
        'flex h-7 w-9 items-center justify-center border-r border-rule last:border-r-0',
        'hover:bg-surface-2 data-[state=on]:bg-accent-soft focus-visible:outline-none',
        'focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
      )}
    >
      {children}
    </Primitive.Item>
  );
}
