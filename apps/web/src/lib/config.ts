declare global {
  interface Window {
    __SCHEMATIC_CONFIG__?: { apiUrl?: string; collabUrl?: string };
  }
}

function firstSet(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((value) => value !== undefined && value.trim() !== '');
}

function derivedCollabUrl(apiUrl: string): string {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/collab';
  return url.toString().replace(/\/$/, '');
}

/**
 * Read at runtime from /config.js, falling back to the build-time variables the
 * dev server provides. One built bundle therefore runs in every environment: a
 * deployment replaces one small file instead of rebuilding the application.
 */
function read() {
  const runtime = typeof window === 'undefined' ? {} : (window.__SCHEMATIC_CONFIG__ ?? {});
  const apiUrl = (
    firstSet(
      runtime.apiUrl,
      import.meta.env['VITE_API_URL'] as string | undefined,
      typeof window === 'undefined' ? undefined : window.location.origin,
    ) ?? 'http://localhost:3001'
  ).replace(/\/+$/, '');

  return {
    apiUrl,
    collabUrl: (
      firstSet(
        runtime.collabUrl,
        import.meta.env['VITE_COLLAB_URL'] as string | undefined,
        derivedCollabUrl(apiUrl),
      ) ?? derivedCollabUrl(apiUrl)
    ).replace(/\/+$/, ''),
  };
}

export const config = read();
