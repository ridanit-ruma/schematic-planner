import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubWindow(value: Record<string, unknown>): void {
  vi.stubGlobal('window', value);
  vi.resetModules();
}

/**
 * The runtime configuration is what lets one built bundle run in every
 * environment, so the precedence between the injected file, the build-time
 * variable, and the page origin is worth pinning down.
 */
describe('config precedence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers the injected runtime value over everything else', async () => {
    stubWindow({
      __SCHEMATIC_CONFIG__: { apiUrl: 'https://api.example/', collabUrl: '' },
      location: { origin: 'https://app.example' },
    });

    const { config } = await import('./config');
    expect(config.apiUrl).toBe('https://api.example');
    // Derived from the API url when the injected file leaves it blank.
    expect(config.collabUrl).toBe('wss://api.example/collab');
  });

  it('falls back to the page origin when nothing is injected', async () => {
    stubWindow({ __SCHEMATIC_CONFIG__: {}, location: { origin: 'http://localhost:4173' } });

    const { config } = await import('./config');
    expect(config.apiUrl).toBe('http://localhost:4173');
    expect(config.collabUrl).toBe('ws://localhost:4173/collab');
  });
});
