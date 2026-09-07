import { describe, expect, it } from 'vitest';

import { resolveWorkspace } from './current-workspace';

const all = [{ slug: 'alpha' }, { slug: 'beta' }, { slug: 'gamma' }];

describe('which workspace the rail shows', () => {
  it('follows the address when it names one', () => {
    expect(resolveWorkspace(all, 'beta', 'gamma')).toEqual({ slug: 'beta' });
  });

  it('keeps where you last were on a screen that names none', () => {
    expect(resolveWorkspace(all, undefined, 'gamma')).toEqual({ slug: 'gamma' });
  });

  it('falls back to the first for an account that has opened none', () => {
    expect(resolveWorkspace(all, undefined, null)).toEqual({ slug: 'alpha' });
  });

  it('ignores a workspace that is no longer there', () => {
    expect(resolveWorkspace(all, undefined, 'deleted')).toEqual({ slug: 'alpha' });
  });

  it('ignores an address naming one that is no longer there', () => {
    expect(resolveWorkspace(all, 'deleted', 'beta')).toEqual({ slug: 'beta' });
  });

  it('has nothing to show when there are no workspaces', () => {
    expect(resolveWorkspace([], undefined, 'beta')).toBeUndefined();
  });
});
