/**
 * Where the application lives.
 *
 * Relative by default, because the usual deployment serves the site and the app
 * from one origin. Baking an absolute address into the build is what makes a
 * built site stop working the moment it moves, so only a split-origin
 * deployment sets NEXT_PUBLIC_APP_URL — and an empty value counts as unset.
 */
export function appUrl(path = '/login'): string {
  const configured = process.env['NEXT_PUBLIC_APP_URL'];
  if (configured === undefined || configured.trim() === '') return path;
  return `${configured.replace(/\/+$/, '')}${path}`;
}
