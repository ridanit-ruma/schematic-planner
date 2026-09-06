import type { PlanDoc, PlanOp } from '@schematic/schema';

import { config } from './config.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export type Role = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  role: Role;
  projectCount: number;
  memberCount: number;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  planCount: number;
  updatedAt: string;
}

export interface Member {
  role: Role;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface PlanSummary {
  id: string;
  title: string;
  description: string;
  nodeCount: number;
  updatedAt: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  /** Set only on a key issued before keys belonged to the account. */
  restrictedTo?: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The access token lives in memory only. The refresh token is an httpOnly
 * cookie the page cannot read, so a script injected into this origin cannot
 * walk away with a long-lived session.
 */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function currentAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  // Single-flight: a page that fires several requests at once must not send
  // several refreshes, because rotation would invalidate its own new token.
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const body = (await response.json()) as { accessToken: string };
      accessToken = body.accessToken;
      return true;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function toError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    issues?: { path: string; message: string }[];
  };
  const message = Array.isArray(body.message)
    ? body.message.join(', ')
    : (body.message ?? response.statusText);
  return new ApiError(response.status, message, body.issues);
}

async function send(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    // fetch reports every network-level failure as the same opaque error, so say
    // what was attempted rather than repeating "Failed to fetch" at the reader.
    throw new ApiError(
      0,
      `Could not reach the server at ${config.apiUrl}. It may be offline, or this address may ` +
        'not be allowed to call it.',
    );
  }

  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return send(path, init, false);
  }
  return response;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init, true);
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const auth = {
  register: (input: { email: string; name: string; password: string }) =>
    api<{ user: AuthUser; accessToken: string }>('/auth/register', {
      method: 'POST',
      ...json(input),
    }),
  login: (input: { email: string; password: string }) =>
    api<{ user: AuthUser; accessToken: string }>('/auth/login', { method: 'POST', ...json(input) }),
  logout: () => api<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => api<{ user: AuthUser }>('/auth/me'),
  providers: () =>
    api<{ password: boolean; registration: boolean; github: boolean; google: boolean }>(
      '/auth/providers',
    ),
  refresh: refreshAccessToken,
};

export const workspaces = {
  list: () => api<WorkspaceSummary[]>('/workspaces'),
  create: (name: string) => api<WorkspaceSummary>('/workspaces', { method: 'POST', ...json({ name }) }),
  update: (id: string, name: string) =>
    api<WorkspaceSummary>(`/workspaces/${id}`, { method: 'PATCH', ...json({ name }) }),
  remove: (id: string, confirm: string) =>
    api<{ ok: true }>(`/workspaces/${id}`, { method: 'DELETE', ...json({ confirm }) }),
  members: (id: string) => api<Member[]>(`/workspaces/${id}/members`),
  updateMember: (id: string, userId: string, role: Role) =>
    api<{ ok: true }>(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', ...json({ role }) }),
  removeMember: (id: string, userId: string) =>
    api<{ ok: true }>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
  invite: (id: string, role: Role) =>
    api<{ url: string }>(`/workspaces/${id}/invites`, { method: 'POST', ...json({ role }) }),
  acceptInvite: (token: string) =>
    api<{ workspace: { id: string; name: string } }>(`/invites/${token}/accept`, { method: 'POST' }),
};

export const projects = {
  list: (workspaceId: string) => api<ProjectSummary[]>(`/workspaces/${workspaceId}/projects`),
  bySlug: (workspaceId: string, slug: string) =>
    api<{ id: string; slug: string; name: string }>(
      `/workspaces/${workspaceId}/projects?slug=${encodeURIComponent(slug)}`,
    ),
  create: (workspaceId: string, name: string) =>
    api<{ id: string; slug: string; name: string }>(`/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      ...json({ name }),
    }),
  update: (id: string, body: { name?: string; description?: string }) =>
    api<{ id: string; slug: string; name: string }>(`/projects/${id}`, {
      method: 'PATCH',
      ...json(body),
    }),
  remove: (id: string) => api<{ ok: true }>(`/projects/${id}`, { method: 'DELETE' }),
};

export const account = {
  // Keys belong to the account, not a workspace: one key reaches every
  // workspace its owner belongs to.
  apiKeys: () => api<ApiKeySummary[]>('/auth/api-keys'),
  createApiKey: (name: string) =>
    api<ApiKeySummary & { key: string; mcpUrl: string }>('/auth/api-keys', {
      method: 'POST',
      ...json({ name }),
    }),
  revokeApiKey: (id: string) => api<{ ok: true }>(`/auth/api-keys/${id}`, { method: 'DELETE' }),
  updateName: (name: string) =>
    api<AuthUser>('/auth/me', { method: 'PATCH', ...json({ name }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: true }>('/auth/password', {
      method: 'POST',
      ...json({ currentPassword, newPassword }),
    }),
  sessions: () => api<SessionSummary[]>('/auth/sessions'),
  revokeSession: (id: string) => api<{ ok: true }>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  revokeOthers: () => api<{ ok: true }>('/auth/sessions', { method: 'DELETE' }),
  remove: (password: string) =>
    api<{ ok: true }>('/auth/me', {
      method: 'DELETE',
      ...json({ password, confirm: 'delete my account' }),
    }),
};

export const plans = {
  list: (projectId: string) => api<PlanSummary[]>(`/projects/${projectId}/plans`),
  create: (projectId: string, title: string) =>
    api<PlanDoc>(`/projects/${projectId}/plans`, { method: 'POST', ...json({ title }) }),
  read: (planId: string) => api<PlanDoc>(`/plans/${planId}`),
  remove: (planId: string) => api<{ ok: true }>(`/plans/${planId}`, { method: 'DELETE' }),
  applyOps: (planId: string, ops: PlanOp[]) =>
    api<PlanDoc>(`/plans/${planId}/ops`, { method: 'POST', ...json({ ops }) }),
  share: (planId: string) => api<{ token: string }>(`/plans/${planId}/share`, { method: 'POST', ...json({}) }),
  unshare: (planId: string) => api<{ ok: true }>(`/plans/${planId}/share`, { method: 'DELETE' }),
  readShared: (token: string) => api<PlanDoc>(`/share/${token}`),
  exportUrl: (planId: string) => `${config.apiUrl}/plans/${planId}/export`,
};

/**
 * The export is an authenticated download, so it cannot be a plain link: the
 * browser would send no Authorization header. Fetch it, then hand the blob to
 * a temporary anchor.
 */
export async function downloadExport(planId: string, filename: string): Promise<void> {
  const response = await send(`/plans/${planId}/export`, {}, true);
  if (!response.ok) throw await toError(response);

  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
