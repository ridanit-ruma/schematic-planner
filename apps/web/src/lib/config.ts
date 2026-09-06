declare global {
  interface Window {
    __SCHEMATIC_CONFIG__?: { apiUrl?: string; collabUrl?: string };
  }
}

function firstSet(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((value) => value !== undefined && value.trim() !== '');
}

const trimEnd = (value: string): string => value.replace(/\/+$/, '');

/**
 * A deployment that serves the API and the app from one origin configures this
 * as `/api`, which is the arrangement that makes the session cookie same-site.
 * A relative value is resolved against the page.
 */
function absolute(value: string, origin: string): string {
  return trimEnd(value.startsWith('/') ? `${origin}${value}` : value);
}

function toWebsocket(url: string): string {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return trimEnd(parsed.toString());
}

/**
 * Read at runtime from /config.js, falling back to the build-time variables the
 * dev server provides. One built bundle therefore runs in every environment: a
 * deployment replaces one small file instead of rebuilding the application.
 */
function read() {
  const runtime = typeof window === 'undefined' ? {} : (window.__SCHEMATIC_CONFIG__ ?? {});
  const origin =
    typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;

  const apiUrl = absolute(
    firstSet(
      runtime.apiUrl,
      import.meta.env['VITE_API_URL'] as string | undefined,
      origin,
    ) ?? origin,
    origin,
  );

  const collab = firstSet(
    runtime.collabUrl,
    import.meta.env['VITE_COLLAB_URL'] as string | undefined,
  );

  return {
    apiUrl,
    collabUrl:
      collab === undefined
        ? toWebsocket(`${apiUrl}/collab`)
        : collab.startsWith('ws')
          ? trimEnd(collab)
          : toWebsocket(absolute(collab, origin)),
  };
}

export const config = read();
