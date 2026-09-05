/**
 * The mark is a two-node schematic fragment: the smallest complete thing this
 * product draws. It says what the tool is without spelling it.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2">
        <svg viewBox="0 0 24 16" className="h-3.5 w-5.5 shrink-0" aria-hidden>
          <rect x="0.5" y="2.5" width="7" height="11" fill="none" stroke="currentColor" />
          <rect x="16.5" y="2.5" width="7" height="11" fill="none" stroke="currentColor" />
          <path d="M8 8 H15" stroke="currentColor" fill="none" />
          <path d="M13 5.5 L16 8 L13 10.5" fill="currentColor" />
        </svg>
        <span className="text-sm font-semibold tracking-tight">Schematic Planner</span>
      </span>
    </span>
  );
}
