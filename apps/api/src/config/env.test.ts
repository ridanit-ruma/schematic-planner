import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from './env.js';

const base = { DATABASE_URL: 'postgresql://localhost/db' };

describe('loadConfig', () => {
  it('fails when the database url is missing', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('reads a comma separated origin list and strips trailing slashes', () => {
    const config = loadConfig({
      ...base,
      CORS_ORIGINS: 'http://a.test/, http://b.test ,',
    });
    expect(config.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
  });

  it('treats the spellings people actually write as booleans', () => {
    expect(loadConfig({ ...base, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).trustProxy).toBe(true);
    expect(loadConfig({ ...base, TRUST_PROXY: 'false' }).trustProxy).toBe(false);
    expect(loadConfig({ ...base, TRUST_PROXY: 'no' }).trustProxy).toBe(false);
  });

  it('refuses to start in production without real secrets', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('falls back to a development secret outside production, loudly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = loadConfig(base);

    expect(config.accessSecret.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports an OAuth provider as unavailable unless both halves are present', () => {
    expect(loadConfig({ ...base, GITHUB_CLIENT_ID: 'id' }).oauth.github).toBeNull();
    expect(
      loadConfig({ ...base, GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' }).oauth.github,
    ).toEqual({ id: 'id', secret: 'secret' });
  });
});
