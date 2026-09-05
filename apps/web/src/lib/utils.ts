import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "3 nodes" / "1 node" without a separate string for every count. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Freshness is shown by an indicator, not by a label that rewrites itself every
 * second. This is only used where an exact time genuinely helps.
 */
export function formatWhen(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days < 1) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (days < 365) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
