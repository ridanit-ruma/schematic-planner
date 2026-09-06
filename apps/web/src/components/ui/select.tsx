import { Select as Primitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A chooser the page owns, rather than the one the operating system draws.
 *
 * A native select renders as whatever the platform decides — a grey Windows
 * combo, a macOS pop-up — and cannot be given the surface, the corners or the
 * dark palette everything else here uses. It also cannot carry a description
 * per option, which matters where the options are relations whose meanings are
 * the whole point.
 */
export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** A line under the option, for choices whose names are not self-explanatory. */
  hint?: string;
}

export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder,
  className,
}: {
  id?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Primitive.Root value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
      <Primitive.Trigger
        id={id}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[2px] border border-rule bg-surface',
          'px-2.5 py-1.5 text-left text-sm text-ink',
          'focus:border-accent focus:outline-none data-[placeholder]:text-ink-faint',
          'disabled:pointer-events-none disabled:opacity-45',
          className,
        )}
      >
        <Primitive.Value placeholder={placeholder} />
        <Primitive.Icon asChild>
          <ChevronDown className="size-3.5 shrink-0 text-ink-faint" />
        </Primitive.Icon>
      </Primitive.Trigger>

      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden',
            'rounded-[2px] border border-rule bg-surface shadow-lg',
          )}
        >
          <Primitive.Viewport className="p-1">
            {options.map((option) => (
              <Primitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'relative cursor-default rounded-[2px] py-1.5 pr-2 pl-7 text-sm text-ink outline-none select-none',
                  'data-[highlighted]:bg-surface-2 data-[state=checked]:bg-accent-soft',
                )}
              >
                <Primitive.ItemIndicator className="absolute top-2 left-2">
                  <Check className="size-3.5 text-accent" />
                </Primitive.ItemIndicator>
                <Primitive.ItemText>{option.label}</Primitive.ItemText>
                {option.hint !== undefined ? (
                  <span className="mt-0.5 block text-xs text-ink-faint">{option.hint}</span>
                ) : null}
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
