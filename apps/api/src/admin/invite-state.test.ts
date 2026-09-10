import { describe, expect, it } from 'vitest';

import { inviteState } from './invite-state.js';

const now = Date.parse('2026-09-11T12:00:00.000Z');
const open = { revokedAt: null, expiresAt: null, maxUses: null, uses: 0 };

describe('inviteState', () => {
  it('lets somebody in when nothing stops it', () => {
    expect(inviteState(open, now)).toBe('live');
  });

  it('says which of the three ways it stopped working', () => {
    expect(inviteState({ ...open, revokedAt: new Date(now) }, now)).toBe('withdrawn');
    expect(inviteState({ ...open, expiresAt: new Date(now - 1) }, now)).toBe('expired');
    expect(inviteState({ ...open, maxUses: 2, uses: 2 }, now)).toBe('used up');
  });

  it('answers with the deliberate one first', () => {
    // Withdrawing an invitation that had also expired is still a withdrawal:
    // what the owner did outranks what time did.
    const both = { ...open, revokedAt: new Date(now), expiresAt: new Date(now - 1) };
    expect(inviteState(both, now)).toBe('withdrawn');
  });

  it('counts a limit as reached, not exceeded', () => {
    expect(inviteState({ ...open, maxUses: 1, uses: 0 }, now)).toBe('live');
    expect(inviteState({ ...open, maxUses: 1, uses: 1 }, now)).toBe('used up');
  });

  it('does not expire on the stroke itself', () => {
    expect(inviteState({ ...open, expiresAt: new Date(now) }, now)).toBe('live');
  });
});
