import { describe, expect, it } from 'vitest';

import { atLeast } from './roles.js';

describe('atLeast', () => {
  it('orders the roles from viewer to owner', () => {
    expect(atLeast('OWNER', 'ADMIN')).toBe(true);
    expect(atLeast('ADMIN', 'EDITOR')).toBe(true);
    expect(atLeast('EDITOR', 'VIEWER')).toBe(true);
    expect(atLeast('VIEWER', 'EDITOR')).toBe(false);
    expect(atLeast('EDITOR', 'ADMIN')).toBe(false);
  });

  it('accepts a role as sufficient for itself', () => {
    expect(atLeast('EDITOR', 'EDITOR')).toBe(true);
  });
});
