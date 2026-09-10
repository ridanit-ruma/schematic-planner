import { ContextMenu as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const content = 'z-50 min-w-44 overflow-hidden rounded-lg bg-surface-3 p-1 elevated';

const item =
  'relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm ' +
  'text-ink outline-none select-none data-[highlighted]:bg-surface-2 ' +
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45';

/**
 * The menu under the right button.
 *
 * On a canvas the pointer is already where the work is, which makes this the
 * shortest route to anything that happens *at a place* — adding a node lands
 * where you asked rather than wherever the viewport happens to be centred.
 * Everything here is also reachable another way; nothing is hidden in it.
 */
export function ContextMenu({ children, menu }: { children: ReactNode; menu: ReactNode }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={content}>{menu}</Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export function ContextAction({
  onSelect,
  disabled,
  tone = 'default',
  hint,
  children,
}: {
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  /** The keystroke that does the same thing, set to the right of the label. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(item, tone === 'danger' && 'text-danger data-[highlighted]:bg-danger/10')}
    >
      <span className="flex flex-1 items-center gap-2">{children}</span>
      {hint === undefined ? null : <span className="slug text-ink-faint">{hint}</span>}
    </Primitive.Item>
  );
}

export function ContextSeparator() {
  return <Primitive.Separator className="my-1 h-px bg-rule" />;
}
