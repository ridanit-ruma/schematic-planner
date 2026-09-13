/** What has become of an invitation. */
export type InviteStatus = 'open' | 'accepted' | 'declined' | 'expired';

/**
 * The one place this is decided.
 *
 * Accepting, declining, listing and the page itself all need the same answer,
 * and four separate `acceptedAt !== null` checks is how they start disagreeing.
 *
 * What happened outranks what time it is: an invitation taken in March and long
 * past its date was still taken, and calling that expired would tell somebody
 * their membership had lapsed.
 */
export function inviteStatus(
  invite: { acceptedAt: Date | null; declinedAt: Date | null; expiresAt: Date },
  now: number = Date.now(),
): InviteStatus {
  if (invite.acceptedAt !== null) return 'accepted';
  if (invite.declinedAt !== null) return 'declined';
  // Good through its last instant, so this is `<` and not `<=`.
  if (invite.expiresAt.getTime() < now) return 'expired';
  return 'open';
}
