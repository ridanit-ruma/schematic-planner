import { describe, expect, it } from 'vitest';

import { inviteStatus } from './invite-status.js';

const now = Date.parse('2026-09-13T12:00:00.000Z');
const open = {
  acceptedAt: null,
  declinedAt: null,
  expiresAt: new Date(now + 60_000),
};

describe('inviteStatus', () => {
  it('is open while nothing has happened to it', () => {
    expect(inviteStatus(open, now)).toBe('open');
  });

  it('names each of the three ways it stops being open', () => {
    expect(inviteStatus({ ...open, acceptedAt: new Date(now) }, now)).toBe('accepted');
    expect(inviteStatus({ ...open, declinedAt: new Date(now) }, now)).toBe('declined');
    expect(inviteStatus({ ...open, expiresAt: new Date(now - 1) }, now)).toBe('expired');
  });

  /*
   * What happened to an invitation outranks what time it is. One that was taken
   * in March and has since passed its date was still taken, and a screen that
   * called it expired would be telling somebody their membership had lapsed.
   */
  it('keeps what happened over what time it is', () => {
    const stale = { ...open, expiresAt: new Date(now - 1) };
    expect(inviteStatus({ ...stale, acceptedAt: new Date(now - 10) }, now)).toBe('accepted');
    expect(inviteStatus({ ...stale, declinedAt: new Date(now - 10) }, now)).toBe('declined');
  });

  it('prefers accepted over declined, because only one of them let somebody in', () => {
    const both = { ...open, acceptedAt: new Date(now), declinedAt: new Date(now) };
    expect(inviteStatus(both, now)).toBe('accepted');
  });

  /* The boundary is deliberate: an invitation is good through its last instant. */
  it('is still open at the exact moment it expires', () => {
    expect(inviteStatus({ ...open, expiresAt: new Date(now) }, now)).toBe('open');
  });

  it('reads the clock when it is not given one', () => {
    expect(inviteStatus({ ...open, expiresAt: new Date(Date.now() - 1) })).toBe('expired');
  });
});
