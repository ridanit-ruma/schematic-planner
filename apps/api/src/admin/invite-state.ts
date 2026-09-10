/** Why an invitation would or would not let somebody in. */
export type InviteState = 'live' | 'used up' | 'expired' | 'withdrawn';

export interface InviteFacts {
  readonly revokedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly maxUses: number | null;
  readonly uses: number;
}

/**
 * Three ways an invitation stops working, and they are not the same thing to
 * whoever is looking at the list: one was taken back on purpose, one ran out of
 * time, one ran out of room. Separated here rather than in the query so the
 * screen and the door agree, and so the rule can be read on its own.
 */
export function inviteState(invite: InviteFacts, now = Date.now()): InviteState {
  if (invite.revokedAt !== null) return 'withdrawn';
  if (invite.expiresAt !== null && invite.expiresAt.getTime() < now) return 'expired';
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return 'used up';
  return 'live';
}
