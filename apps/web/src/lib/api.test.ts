import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** An unsigned token carrying only the claims the client reads. */
function token(claims: { iat?: number; exp?: number }): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

async function load() {
  vi.resetModules();
  vi.stubGlobal('window', { location: { origin: 'https://app.example' } });
  return import('./api');
}

function answer(status: number, body: object = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('renewalDelay', () => {
  const seconds = Date.parse('2026-09-26T10:00:00.000Z') / 1000;

  it('renews a minute before a fifteen-minute token runs out', async () => {
    const { renewalDelay } = await load();
    expect(renewalDelay(token({ iat: seconds, exp: seconds + 900 }))).toBe(840_000);
  });

  it('renews a short-lived token halfway through, not on a loop', async () => {
    const { renewalDelay } = await load();
    expect(renewalDelay(token({ iat: seconds, exp: seconds + 60 }))).toBe(30_000);
  });

  /* A machine whose clock is an hour out must not see every token as expired
     on arrival and renew it over and over. */
  it('reads the lifetime from the token, not from this machine’s clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime((seconds + 3_600) * 1000);
    const { renewalDelay } = await load();
    expect(renewalDelay(token({ iat: seconds, exp: seconds + 900 }))).toBe(840_000);
    vi.useRealTimers();
  });

  it('never renews sooner than a few seconds after a token arrives', async () => {
    const { renewalDelay } = await load();
    expect(renewalDelay(token({ iat: seconds, exp: seconds }))).toBe(5_000);
  });

  it('says nothing about a token it cannot read', async () => {
    const { renewalDelay } = await load();
    expect(renewalDelay('not-a-token')).toBeNull();
    expect(renewalDelay(token({ iat: seconds }))).toBeNull();
  });
});

describe('refreshing the access token', () => {
  const fresh = token({ iat: 2_000_000_000, exp: 2_000_000_900 });
  let fetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('navigator', {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('signs the screen out when the server says the session is over', async () => {
    const api = await load();
    const lost = vi.fn();
    api.onSessionLost(lost);
    api.setAccessToken(fresh);
    fetch.mockResolvedValueOnce(answer(401, { message: 'Session expired' }));

    expect(await api.auth.refresh()).toBe(false);
    expect(api.currentAccessToken()).toBeNull();
    expect(lost).toHaveBeenCalledOnce();
  });

  it('keeps the session when the server is busy or unreachable', async () => {
    const api = await load();
    const lost = vi.fn();
    api.onSessionLost(lost);
    api.setAccessToken(fresh);
    fetch.mockResolvedValueOnce(answer(503)).mockRejectedValueOnce(new TypeError('offline'));

    const outcome = api.auth.refresh();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await outcome).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(api.currentAccessToken()).toBe(fresh);
    expect(lost).not.toHaveBeenCalled();
  });

  it('asks again after a request whose answer was lost, and takes the new token', async () => {
    const api = await load();
    fetch
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(answer(201, { accessToken: fresh }));

    const outcome = api.auth.refresh();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await outcome).toBe(true);
    expect(api.currentAccessToken()).toBe(fresh);
  });

  it('sends one refresh for many callers, and holds the cross-tab lock while it does', async () => {
    const request = vi.fn((_name: string, work: () => Promise<unknown>) => work());
    vi.stubGlobal('navigator', { locks: { request } });
    const api = await load();
    fetch.mockResolvedValueOnce(answer(201, { accessToken: fresh }));

    const all = await Promise.all([api.auth.refresh(), api.auth.refresh(), api.auth.refresh()]);

    expect(all).toEqual([true, true, true]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[0]).toBe('schematic-refresh');
  });

  it('renews on its own shortly before the token runs out', async () => {
    vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
    const api = await load();
    const now = Date.now() / 1000;
    api.setAccessToken(token({ iat: now, exp: now + 900 }));
    fetch.mockResolvedValue(answer(201, { accessToken: fresh }));

    await vi.advanceTimersByTimeAsync(839_000);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetch).toHaveBeenCalledOnce();
    expect(api.currentAccessToken()).toBe(fresh);
  });
});
