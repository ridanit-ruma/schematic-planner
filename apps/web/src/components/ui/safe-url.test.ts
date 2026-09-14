import { describe, expect, it } from 'vitest';

import { safeUrl } from './safe-url';

describe('which links a plan may carry', () => {
  it('passes the three schemes a note has any business using', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:someone@example.com')).toBe('mailto:someone@example.com');
  });

  /* A plan opens through a share link with no login, so a link in a document
     somebody else wrote is a path to a real viewer. */
  it('refuses a scheme that runs something', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('JavaScript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html;base64,PHN2Zz4=')).toBeUndefined();
    expect(safeUrl('vbscript:msgbox')).toBeUndefined();
  });

  it('refuses one that is only pretending to have no scheme', () => {
    expect(safeUrl('//evil.example.com')).toBeUndefined();
    expect(safeUrl(' javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('java\tscript:alert(1)')).toBeUndefined();
  });

  it('lets a plain fragment or relative path through', () => {
    expect(safeUrl('#anchor')).toBe('#anchor');
    expect(safeUrl('./notes.md')).toBe('./notes.md');
  });

  it('refuses nothing at all', () => {
    expect(safeUrl('')).toBeUndefined();
  });
});
