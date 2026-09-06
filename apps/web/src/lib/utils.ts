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
  const now = new Date();

  // By calendar day, not by elapsed hours: eleven last night is under
  // twenty-four hours old and showing it as "11:00 PM" reads as today.
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
