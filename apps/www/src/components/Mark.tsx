/**
 * The mark: two cards, one behind the other, and a live node on the corner
 * where they meet — the smallest complete thing this product draws.
 *
 * The full icon carries a plus and a pair of chips inside the front card. They
 * are dropped here: at the 20 to 24 pixels this is shown at they turn to a
 * smudge, and what identifies the mark at that size is the silhouette.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="3.25"
        y="7.25"
        width="11.5"
        height="11.5"
        rx="2.75"
        fill="var(--surface-3)"
        stroke="var(--rule-strong)"
        strokeWidth="1.2"
      />
      <rect x="9" y="4.5" width="12.5" height="12.5" rx="3.25" fill="var(--accent)" />
      <circle cx="8.25" cy="16.75" r="3.4" fill="var(--ground)" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="8.25" cy="16.75" r="1.5" fill="var(--status-done)" />
    </svg>
  );
}
