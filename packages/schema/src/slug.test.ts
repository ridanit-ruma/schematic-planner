import { describe, expect, it } from 'vitest';

import { SLUG_MAX_LENGTH, isSlug, slugify, uniqueSlug } from './slug.js';

describe('slugify', () => {
  it('lowercases words and joins them with single hyphens', () => {
    expect(slugify('Auth Service')).toBe('auth-service');
    expect(slugify('  --Hello,   World!! ')).toBe('hello-world');
  });

  it('falls back to a placeholder when nothing ASCII survives', () => {
    expect(slugify('인증 서비스')).toBe('node');
  });

  it('never exceeds the maximum length or ends in a hyphen', () => {
    const slug = slugify('a '.repeat(200));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
    expect(isSlug(slug)).toBe(true);
  });
});

describe('uniqueSlug', () => {
  it('returns the plain slug when it is free', () => {
    expect(uniqueSlug('Auth Service', [])).toBe('auth-service');
  });

  it('appends the first free counter when taken', () => {
    expect(uniqueSlug('Auth Service', ['auth-service'])).toBe('auth-service-2');
    expect(uniqueSlug('Auth Service', ['auth-service', 'auth-service-2'])).toBe('auth-service-3');
  });

  it('keeps the counter inside the length limit', () => {
    const taken = ['a'.repeat(SLUG_MAX_LENGTH)];
    const slug = uniqueSlug('a'.repeat(SLUG_MAX_LENGTH), taken);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(taken).not.toContain(slug);
  });
});
