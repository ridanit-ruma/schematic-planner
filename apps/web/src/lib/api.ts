import type { PlanDoc, PlanOp } from '@schematic/schema';

import { t } from '@/i18n';

import { config } from './config.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /**
   * Standing in the instance, which is not standing in a workspace. Absent from
   * the answers that sign you in, present on the one that says who you are.
   */
  instanceRole?: InstanceRole;
}

export type InstanceRole = 'OWNER' | 'MEMBER';

export type Role = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

/** Deleting, restoring and the workspace's own settings all need this much. */
export function canAdminister(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

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

/** An invitation to a workspace that has not been used or expired. */
export interface WorkspaceInvite {
  id: string;
  /** The first characters of the link, so a list can say which one this is. */
  prefix: string;
  role: Role;
  email: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
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
  /** Which drawer of the project, or null for its top level. */
  folderId: string | null;
}

export interface FolderSummary {
  id: string;
  name: string;
  /** The folder it sits in, or null at the project's top level. */
  parentId: string | null;
  /** Names from the project's top level down to this folder, its own last. */
  path: string[];
  /** Plans filed directly in it, not in the folders below it. */
  planCount: number;
  updatedAt: string;
}

/** A folder as `folders.create` and `folders.update` answer it. */
export interface FolderRecord {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
}

/**
 * A whole workspace as the explorer draws it: projects, their folders (nested
 * through `parentId`) and the plans filed in them, with nothing from the trash.
 */
export interface WorkspaceNavigation {
  workspace: { id: string; slug: string; name: string; role: Role };
  projects: {
    id: string;
    slug: string;
    name: string;
    /** `parentId` is null for a folder at the project's own top level. */
    folders: { id: string; name: string; parentId: string | null }[];
    /** `folderId` is null for a plan at the project's own top level. */
    plans: { id: string; title: string; updatedAt: string; folderId: string | null }[];
  }[];
}

/** The workspace tree around one plan, with the project that plan is in. */
export interface PlanNavigation extends WorkspaceNavigation {
  projectId: string;
}

/** One line on the screen the application opens on. */
export interface RecentPlan {
  id: string;
  title: string;
  updatedAt: string;
  project: { slug: string; name: string };
  workspace: { slug: string; name: string };
  lastChange: {
    label: string;
    at: string;
    by: Omit<ChangeAuthor, 'id'> | null;
  } | null;
}

export interface TrashItem {
  kind: 'plan' | 'project' | 'folder';
  id: string;
  name: string;
  where: string;
  /** For a plan or a folder: its project and the folders above it, top down. */
  location: { project: string; folders: string[] } | null;
  deletedAt: string;
  by: { name: string; avatarUrl: string | null } | null;
  /** Still answering a public share link, which this is the only place to stop. */
  shared: boolean;
}

export interface PlanChangeRecord {
  id: string;
  kind: string;
  subject: string;
  label: string;
  detail: string | null;
  at: string;
  /** The act this entry arrived with. Null for anything recorded before batches. */
  batchId: string | null;
  by: ChangeAuthor | null;
}

/**
 * A key acts for the person who issued it, so both names matter: the person
 * alone reads as somebody at a keyboard, the key alone hides whose permission
 * it was working under.
 */
export interface ChangeAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** The key's name when an agent made the change, null when a person did. */
  agent: string | null;
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
let renewal: ReturnType<typeof setTimeout> | undefined;
let sessionLost: () => void = () => undefined;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  scheduleRenewal();
}

export function currentAccessToken(): string | null {
  return accessToken;
}

/**
 * Called when the server has said the session is over — the refresh cookie is
 * missing, expired or revoked — so the screen can stop claiming to be signed
 * in. Carrying on instead sent every later request with no token at all, and
 * the person met "Missing access token" and a canvas that said the plan was
 * not there.
 */
export function onSessionLost(handler: () => void): void {
  sessionLost = handler;
}

/** Renew this long before the access token runs out, at most. */
const RENEW_AHEAD_MS = 60_000;
/** After a renewal the server could not answer, try again this much later: well inside
 * the grace period in which the server still takes a cookie whose answer was lost. */
const RETRY_RENEWAL_MS = 10_000;

/** Never renew sooner than this after a token arrives, whatever it claims. */
const MIN_RENEWAL_MS = 5_000;

/**
 * How long after an access token arrives it should be renewed, or null when it
 * cannot be read: a minute before it expires, or halfway through its life when
 * it lives less than two minutes.
 *
 * Measured from its lifetime (`exp - iat`, both the server's clock) rather than
 * from `exp` against this machine's clock, so a clock that is wrong cannot make
 * every token look expired on arrival and renew it in a loop.
 */
export function renewalDelay(token: string): number | null {
  const payload = token.split('.')[1];
  if (payload === undefined) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: unknown;
      iat?: unknown;
    };
    if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return null;
    const lifetime = (claims.exp - claims.iat) * 1000;
    return Math.max(MIN_RENEWAL_MS, lifetime - Math.min(RENEW_AHEAD_MS, lifetime / 2));
  } catch {
    return null;
  }
}

/** When the token in hand is due for renewal, by this machine's clock. */
let renewAt = Infinity;

/**
 * Renewing ahead of expiry rather than after a 401 means a tab left open does
 * not come back holding a dead token, and the collaboration socket, which is
 * only authenticated when it connects, always has a live one to reconnect with.
 */
function scheduleRenewal(): void {
  clearTimeout(renewal);
  renewal = undefined;
  renewAt = Infinity;
  if (accessToken === null) return;
  const delay = renewalDelay(accessToken);
  if (delay === null) return;
  renewAt = Date.now() + delay;
  renewal = setTimeout(() => void refreshAccessToken(), delay);
}

/*
 * A hidden tab's timers are throttled and a sleeping machine's do not run at
 * all, so coming back is also a moment to check.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || accessToken === null) return;
    if (Date.now() >= renewAt) void refreshAccessToken();
  });
}

type RefreshOutcome = 'renewed' | 'lost' | 'unavailable';

async function exchangeCookie(): Promise<RefreshOutcome> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response | null = null;
    try {
      response = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // The request may or may not have reached the server. If it did, the
      // server rotated the cookie and the answer is gone with the connection;
      // its grace period takes the old cookie once more, so asking again is safe.
    }
    if (response?.ok === true) {
      const body = (await response.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return 'renewed';
    }
    // Only the API's own answer that there is no session ends it. Being turned
    // away for asking too often, a server that is down, or something in front
    // of it answering instead is not the same as not being signed in, and
    // treating them alike signed people out of perfectly good sessions.
    if (response?.status === 401) return 'lost';
    if (attempt >= 1) return 'unavailable';
    const after = Number(response?.headers.get('retry-after'));
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1000, 5000),
      ),
    );
  }
}

/**
 * One refresh at a time, in this tab and across every tab of this origin.
 *
 * Rotation spends the cookie: two requests presenting the same one race, and
 * the one that loses is told the session is over. Within a tab the in-flight
 * promise is shared; across tabs a Web Lock queues them, so the second tab
 * presents the cookie the first one was just given.
 */
async function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
      const outcome =
        locks === undefined
          ? await exchangeCookie()
          : await locks.request('schematic-refresh', exchangeCookie);
      if (outcome === 'lost') {
        setAccessToken(null);
        sessionLost();
      } else if (outcome === 'unavailable' && accessToken !== null) {
        // Nothing was decided, so the session is still there to renew.
        clearTimeout(renewal);
        renewal = setTimeout(() => void refreshAccessToken(), RETRY_RENEWAL_MS);
      }
      return outcome === 'renewed';
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
    throw new ApiError(0, t().ui.api.unreachable(config.apiUrl));
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
  register: (input: { email: string; name: string; password: string; inviteCode?: string }) =>
    api<{ user: AuthUser; accessToken: string }>('/auth/register', {
      method: 'POST',
      ...json(input),
    }),
  login: (input: { email: string; password: string }) =>
    api<{ user: AuthUser; accessToken: string }>('/auth/login', { method: 'POST', ...json(input) }),
  logout: () => api<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => api<{ user: AuthUser }>('/auth/me'),
  providers: () =>
    api<{
      password: boolean;
      registration: boolean;
      /** This instance is holding sign-up behind a code. */
      inviteCode: boolean;
      github: boolean;
      google: boolean;
    }>('/auth/providers'),
  refresh: refreshAccessToken,
};

export interface InvitePreview {
  readonly workspace: { readonly id: string; readonly name: string };
  readonly role: Role;
  readonly invitedBy: { readonly name: string };
  /** The address it was sent to, when it was sent to one. */
  readonly email: string | null;
  readonly status: 'open' | 'accepted' | 'declined' | 'expired';
}

export const workspaces = {
  list: () => api<WorkspaceSummary[]>('/workspaces'),
  create: (name: string) =>
    api<WorkspaceSummary>('/workspaces', { method: 'POST', ...json({ name }) }),
  update: (id: string, name: string) =>
    api<WorkspaceSummary>(`/workspaces/${id}`, { method: 'PATCH', ...json({ name }) }),
  remove: (id: string, confirm: string) =>
    api<{ ok: true }>(`/workspaces/${id}`, { method: 'DELETE', ...json({ confirm }) }),
  members: (id: string) => api<Member[]>(`/workspaces/${id}/members`),
  updateMember: (id: string, userId: string, role: Role) =>
    api<{ ok: true }>(`/workspaces/${id}/members/${userId}`, {
      method: 'PATCH',
      ...json({ role }),
    }),
  removeMember: (id: string, userId: string) =>
    api<{ ok: true }>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
  invite: (id: string, role: Role) =>
    api<{ url: string }>(`/workspaces/${id}/invites`, { method: 'POST', ...json({ role }) }),
  /** Only the ones that would still let somebody in. */
  invites: (id: string) => api<WorkspaceInvite[]>(`/workspaces/${id}/invites`),
  revokeInvite: (id: string, inviteId: string) =>
    api<{ ok: true }>(`/workspaces/${id}/invites/${inviteId}`, { method: 'DELETE' }),
  acceptInvite: (token: string) =>
    api<{ workspace: { id: string; name: string } }>(`/invites/${token}/accept`, {
      method: 'POST',
    }),
  /** Readable without a session: the token is the capability, not the cookie. */
  previewInvite: (token: string) => api<InvitePreview>(`/invites/${token}`),
  declineInvite: (token: string) =>
    api<{ ok: true }>(`/invites/${token}/decline`, { method: 'POST' }),
  /** Every project, folder and plan in the workspace, for the explorer. */
  navigation: (id: string) => api<WorkspaceNavigation>(`/workspaces/${id}/navigation`),
};

export const projects = {
  list: (workspaceId: string) => api<ProjectSummary[]>(`/workspaces/${workspaceId}/projects`),
  bySlug: (workspaceId: string, slug: string) =>
    api<{ id: string; slug: string; name: string }>(
      `/workspaces/${workspaceId}/projects?slug=${encodeURIComponent(slug)}`,
    ),
  create: (workspaceId: string, name: string, description = '') =>
    api<{ id: string; slug: string; name: string }>(`/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      ...json({ name, description }),
    }),
  read: (id: string) =>
    api<{
      id: string;
      slug: string;
      name: string;
      description: string;
      workspace: { id: string; slug: string; name: string };
      role: Role;
    }>(`/projects/${id}`),
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
  setAvatar: (png: Blob) =>
    api<{ avatarUrl: string }>('/auth/me/avatar', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png,
    }),
  clearAvatar: () => api<{ ok: true }>('/auth/me/avatar', { method: 'DELETE' }),
  updateName: (name: string) => api<AuthUser>('/auth/me', { method: 'PATCH', ...json({ name }) }),
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

/**
 * Drawers inside a project, which may hold drawers of their own. Names are
 * unique among siblings: a clash answers 409, a move into itself 400.
 */
export const folders = {
  /** Every folder outside the trash, in tree order. */
  list: (projectId: string) => api<FolderSummary[]>(`/projects/${projectId}/folders`),
  /** `parentId` null, or left out, makes it at the project's top level. */
  create: (projectId: string, name: string, parentId: string | null = null) =>
    api<FolderRecord>(`/projects/${projectId}/folders`, {
      method: 'POST',
      ...json({ name, parentId }),
    }),
  rename: (id: string, name: string) =>
    api<FolderRecord>(`/folders/${id}`, {
      method: 'PATCH',
      ...json({ name }),
    }),
  /** Into another folder of the same project, or to its top level with null. */
  move: (id: string, parentId: string | null) =>
    api<FolderRecord>(`/folders/${id}`, {
      method: 'PATCH',
      ...json({ parentId }),
    }),
  remove: (id: string) => api<{ ok: true }>(`/folders/${id}`, { method: 'DELETE' }),
};

export const plans = {
  list: (projectId: string) => api<PlanSummary[]>(`/projects/${projectId}/plans`),
  recent: () => api<RecentPlan[]>('/recent'),
  create: (projectId: string, title: string, description = '', folderId: string | null = null) =>
    api<PlanDoc>(`/projects/${projectId}/plans`, {
      method: 'POST',
      ...json({ title, description, folderId }),
    }),
  read: (planId: string) => api<PlanDoc>(`/plans/${planId}`),
  update: (planId: string, body: { title?: string; description?: string }) =>
    api<PlanDoc>(`/plans/${planId}`, { method: 'PATCH', ...json(body) }),
  /** To another project, which may be in another workspace, and to a drawer in it. */
  move: (planId: string, projectId: string, folderId: string | null = null) =>
    api<{ ok: true }>(`/plans/${planId}/move`, {
      method: 'POST',
      ...json({ projectId, folderId }),
    }),
  navigation: (planId: string) => api<PlanNavigation>(`/plans/${planId}/navigation`),
  changes: (planId: string) => api<PlanChangeRecord[]>(`/plans/${planId}/changes`),
  remove: (planId: string) => api<{ ok: true }>(`/plans/${planId}`, { method: 'DELETE' }),
  applyOps: (planId: string, ops: PlanOp[]) =>
    api<PlanDoc>(`/plans/${planId}/ops`, { method: 'POST', ...json({ ops }) }),
  share: (planId: string) =>
    api<{ token: string }>(`/plans/${planId}/share`, { method: 'POST', ...json({}) }),
  unshare: (planId: string) => api<{ ok: true }>(`/plans/${planId}/share`, { method: 'DELETE' }),
  readShared: (token: string) => api<PlanDoc>(`/share/${token}`),
  exportUrl: (planId: string) => `${config.apiUrl}/plans/${planId}/export`,
};

/**
 * Deleting puts something here rather than destroying it. Emptying the trash is
 * the act that actually removes rows.
 */
export const trash = {
  list: (workspaceId: string) => api<TrashItem[]>(`/workspaces/${workspaceId}/trash`),
  empty: (workspaceId: string) =>
    api<{ removed: number }>(`/workspaces/${workspaceId}/trash`, { method: 'DELETE' }),
  restore: (kind: TrashItem['kind'], id: string) =>
    api<{ ok: true }>(`/trash/${kind}s/${id}/restore`, { method: 'POST' }),
  purge: (kind: TrashItem['kind'], id: string) =>
    api<{ ok: true }>(`/trash/${kind}s/${id}`, { method: 'DELETE' }),
};

export interface InviteSummary {
  id: string;
  label: string;
  prefix: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string;
  state: 'live' | 'used up' | 'expired' | 'withdrawn';
  accounts: { id: string; name: string; email: string; createdAt: string }[];
}

export interface AccountSummary {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  instanceRole: InstanceRole;
  suspendedAt: string | null;
  createdAt: string;
  invitedVia: { id: string; label: string } | null;
  workspaces: number;
  plans: number;
  keys: number;
  sessions: number;
  lastChangeAt: string | null;
}

export interface Usage {
  accounts: { total: number; suspended: number; joinedRecently: number; activeRecently: number };
  content: {
    workspaces: number;
    projects: number;
    plans: number;
    trashedPlans: number;
    nodes: number;
    edges: number;
    largestPlan: number;
  };
  activity: {
    changes: number;
    changesRecently: number;
    byAgents: number;
    trend: { day: string; people: number; agents: number }[];
  };
  agents: {
    keys: number;
    liveKeys: number;
    recent: { name: string; by: string; lastUsedAt: string | null }[];
  };
  reach: { sessions: number; shares: number; liveInvites: number };
  live: { documents: number; connections: number };
  storage: { databaseBytes: number };
  busiest: { name: string; slug: string; plans: number; changes: number }[];
  days: number;
  recentDays: number;
}

/** The instance rather than a workspace. Every one of these is owner-only. */
export const admin = {
  usage: () => api<Usage>('/admin/usage'),
  invites: () => api<{ code: string | null; invites: InviteSummary[] }>('/admin/invites'),
  createInvite: (input: { label: string; maxUses: number | null; expiresInDays: number | null }) =>
    api<{ id: string; token: string; prefix: string }>('/admin/invites', {
      method: 'POST',
      ...json(input),
    }),
  withdrawInvite: (id: string) =>
    api<{ ok: true }>(`/admin/invites/${id}/withdraw`, { method: 'POST', ...json({}) }),
  deleteInvite: (id: string) => api<{ ok: true }>(`/admin/invites/${id}`, { method: 'DELETE' }),
  accounts: () => api<AccountSummary[]>('/admin/accounts'),
  updateAccount: (id: string, input: { instanceRole?: InstanceRole; suspended?: boolean }) =>
    api<{ ok: true }>(`/admin/accounts/${id}`, { method: 'PATCH', ...json(input) }),
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

/**
 * Whether the server said this address leads nowhere the caller can reach.
 *
 * 404 and not 403, for everything below a workspace: a membership check that
 * answered "forbidden" would confirm the thing exists, which is the fact being
 * protected. So one test, and one screen behind it.
 */
export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
