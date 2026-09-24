import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthPage } from './AuthPage';

// A server render reads a zustand store's initial state whatever it has been
// set to, so the status is handed in here instead of set on the real store.
let status = 'loading';
vi.mock('@/lib/auth-store', () => ({ useAuth: () => ({ status }) }));

const render = (): string =>
  renderToString(
    <MemoryRouter initialEntries={['/login']}>
      <AuthPage mode="sign-in" />
    </MemoryRouter>,
  );

/**
 * "Open the app" lands on /login, and so does anybody who already has a session.
 * Until the session has been asked about, the page does not know which of the
 * two it is looking at — and showing the form in that moment flashes a sign-in
 * screen at somebody who is about to be sent straight past it.
 */
describe('AuthPage', () => {
  it('waits for the session before offering to sign in', () => {
    status = 'loading';
    const html = render();
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<form');
  });

  it('offers to sign in once there is no session', () => {
    status = 'signed-out';
    expect(render()).toContain('<form');
  });
});
