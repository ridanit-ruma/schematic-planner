import { Tooltip as Primitive } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Wraps the application once. Radix keeps one timer across every tooltip below
 * it, so moving between two controls shows the second immediately instead of
 * waiting out the delay again.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </Primitive.Provider>
  );
}

/**
 * The browser's own tooltip cannot be styled, appears after a delay nobody can
 * set, and never appears at all on a touch screen. This one belongs to the
 * page. It is a hint and never the only place something is said — anything a
 * reader must know is written on the surface.
 */
export function Tooltip({
  content,
  side = 'bottom',
  children,
}: {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactElement;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 max-w-72 rounded-[2px] border border-rule bg-surface px-2 py-1.5',
            'text-xs leading-snug text-ink shadow-lg',
          )}
        >
          {content}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
