import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/utils';

/*
 * A low-contrast well rather than a raised box. Focus is announced by an
 * indigo rim and a short ambient glow — the same beacon the rest of the
 * interface uses to say "you are here" — instead of a browser outline.
 */
const control =
  'w-full rounded-md border border-rule bg-surface px-2.5 py-1.5 text-sm text-ink ' +
  'transition-[border-color,box-shadow] duration-100 ' +
  'placeholder:text-ink-faint focus:outline-none focus:focus-glow';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'resize-y leading-relaxed', className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children(id)}
      {error !== undefined ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint !== undefined ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
