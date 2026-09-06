import { create } from 'zustand';

import { auth, setAccessToken, type AuthUser } from './api.js';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Applies a change made to the signed-in account, without another round trip. */
  patchUser: (patch: Partial<AuthUser>) => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  /** Exchanges the refresh cookie for a session on page load. */
  bootstrap: async () => {
    if (!(await auth.refresh())) {
      set({ status: 'signed-out', user: null });
      return;
    }
    try {
      const { user } = await auth.me();
      set({ status: 'signed-in', user });
    } catch {
      set({ status: 'signed-out', user: null });
    }
  },

  signIn: async (email, password) => {
    const { user, accessToken } = await auth.login({ email, password });
    setAccessToken(accessToken);
    set({ status: 'signed-in', user });
  },

  signUp: async (name, email, password) => {
    const { user, accessToken } = await auth.register({ name, email, password });
    setAccessToken(accessToken);
    set({ status: 'signed-in', user });
  },

  patchUser: (patch) =>
    set((state) => (state.user === null ? state : { user: { ...state.user, ...patch } })),

  signOut: async () => {
    await auth.logout().catch(() => undefined);
    setAccessToken(null);
    set({ status: 'signed-out', user: null });
  },
}));
