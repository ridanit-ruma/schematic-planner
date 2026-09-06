import { ToggleGroup as Primitive } from 'radix-ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';

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

/**
 * Passes on whatever is given to it. Anything that wraps this with `asChild` —
 * a tooltip, for one — hands down the handlers and the ref that make it work,
 * and a component that quietly dropped them left the wrapper doing nothing.
 */
export function ToggleItem({
  value,
  label,
  selected,
  children,
  className,
  ...rest
}: {
  value: string;
  label: string;
  /**
   * Which one is chosen, said plainly rather than read from Radix's own
   * data-state. Anything that wraps this with `asChild` — a tooltip — writes
   * its own data-state over the group's, and the highlight silently went out.
   */
  selected: boolean;
  children: ReactNode;
} & ComponentPropsWithRef<'button'>) {
  return (
    <Primitive.Item
      {...rest}
      value={value}
      aria-label={label}
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'flex h-7 w-9 items-center justify-center border-r border-rule last:border-r-0',
        'hover:bg-surface-2 data-[selected]:bg-accent-soft focus-visible:outline-none',
        'focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset',
        className,
      )}
    >
      {children}
    </Primitive.Item>
  );
}
