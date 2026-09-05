import { describe, expect, it } from 'vitest';

import { hashToken, randomToken, tokensMatch } from './crypto.js';

describe('randomToken', () => {
  it('is url safe and does not repeat', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('hashToken', () => {
  it('is stable and does not reveal the token', () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });
});

describe('tokensMatch', () => {
  it('compares equal and unequal values', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
  });
});
