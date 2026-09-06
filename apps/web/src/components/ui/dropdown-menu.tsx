import { DropdownMenu as Primitive } from 'radix-ui';
import { Check } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const content =
  'z-50 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-lg ' +
  'bg-surface-3 p-1 elevated';

const item =
  'relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm ' +
  'text-ink outline-none select-none data-[highlighted]:bg-surface-2 ' +
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45';

/**
 * A menu, for a control that offers actions rather than a value.
 *
 * The distinction matters: switching workspace and creating one are not two
 * values of the same field, and a native select that mixed them made "New
 * workspace…" look like somewhere you could already be.
 */
export function DropdownMenu({
  trigger,
  children,
  align = 'start',
}: {
  trigger: ReactElement;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content align={align} sideOffset={4} className={content}>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export function DropdownItem({
  onSelect,
  selected,
  disabled,
  children,
}: {
  onSelect: () => void;
  selected?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Primitive.Item onSelect={onSelect} disabled={disabled} className={cn(item, 'pl-7')}>
      {selected === true ? <Check className="absolute left-2 size-3.5 text-accent" /> : null}
      {children}
    </Primitive.Item>
  );
}

/** An action rather than a choice: no room is kept for a tick. */
export function DropdownAction({
  onSelect,
  children,
}: {
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Primitive.Item onSelect={onSelect} className={item}>
      {children}
    </Primitive.Item>
  );
}

export function DropdownSeparator() {
  return <Primitive.Separator className="my-1 h-px bg-rule" />;
}
