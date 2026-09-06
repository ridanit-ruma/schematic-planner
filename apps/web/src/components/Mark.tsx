/**
 * The mark: two cards, one behind the other, and a live node on the corner
 * where they meet. It is the smallest complete thing this product draws — a
 * part, a part it connects to, and the fact that something is running through
 * them.
 *
 * Drawn flat rather than as the full app icon: at 24px the icon's registration
 * ring and crosshairs turn to mud, and what survives is the pair of cards.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="3.5"
        y="7.5"
        width="11"
        height="11"
        rx="2.5"
        fill="var(--surface-3)"
        stroke="var(--rule-strong)"
      />
      <rect x="9" y="5" width="12" height="12" rx="3" fill="var(--accent)" />
      <path d="M15 8.2 V13.8 M12.2 11 H17.8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8.5" cy="16.5" r="3" fill="var(--ground)" stroke="var(--accent)" strokeWidth="1.3" />
      <circle cx="8.5" cy="16.5" r="1.3" fill="var(--status-done)" />
    </svg>
  );
}

/** The mark with the product's name beside it, for sign-in and the site. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2">
        <Mark className="size-6 shrink-0" />
        <span className="text-base font-semibold tracking-tight">Schematic Planner</span>
      </span>
    </span>
  );
}
