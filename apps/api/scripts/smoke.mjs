/**
 * End-to-end smoke check against a running server.
 *
 * Unit tests cover the pure packages well, but they cannot see the seams: the
 * websocket upgrade path, whether Hocuspocus is actually fed frames, whether the
 * CRDT reaches Postgres. Every one of those broke at least once and no test
 * noticed. This script exercises them against a real instance.
 *
 *   pnpm --filter @schematic/api smoke
 *   SMOKE_API_URL=https://your-instance.example pnpm --filter @schematic/api smoke
 *
 * It registers a throwaway account and leaves it behind; point it at a
 * development instance, not production.
 */
import { HocuspocusProvider } from '@hocuspocus/provider';
import { planOpsSchema } from '@schematic/schema';
import { applyOps, readPlanDoc } from '@schematic/ydoc';
import * as Y from 'yjs';

const API = (process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const COLLAB =
  process.env.SMOKE_COLLAB_URL ?? `${API.replace(/^http/, 'ws')}/collab`;

let failures = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail === '' ? '' : `  ${detail}`}`);
}
function section(title) {
  console.log(`\n${title}`);
}

async function call(path, { token, method = 'GET', body, bytes, contentType, raw = false } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(contentType !== undefined && { 'Content-Type': contentType }),
      ...(token !== undefined && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...(bytes !== undefined && { body: bytes }),
  });
  if (raw) return response;
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function main() {
  section('auth');
  const email = `smoke-${Date.now()}@example.invalid`;
  let registered = await call('/auth/register', {
    method: 'POST',
    body: { email, name: 'Smoke', password: 'correct-horse-battery' },
  });

  if (registered.status === 429) {
    // This run's own throttling section spends the allowance for this address,
    // so a second run straight afterwards is turned away here. Waiting is
    // correct behaviour, not a failure — say so and carry on.
    console.log('  … rate limited from a previous run; waiting for the window');
    await wait(62_000);
    registered = await call('/auth/register', {
      method: 'POST',
      body: { email, name: 'Smoke', password: 'correct-horse-battery' },
    });
  }
  check('register', registered.status === 201 || registered.status === 200, `status ${registered.status}`);
  const token = registered.body.accessToken;
  check('access token issued', typeof token === 'string' && token.length > 20);

  const me = await call('/auth/me', { token });
  check('GET /auth/me', me.body.user?.email === email);
  check('unauthenticated request refused', (await call('/auth/me')).status === 401);

  section('workspace, project and plan');
  const workspaces = await call('/workspaces', { token });
  const workspaceId = workspaces.body[0]?.id;
  check('a workspace exists at sign-up', typeof workspaceId === 'string');

  const projects = await call(`/workspaces/${workspaceId}/projects`, { token });
  const projectId = projects.body[0]?.id;
  check('a project exists at sign-up', typeof projectId === 'string', projects.body[0]?.slug ?? '');

  const namedProject = await call(`/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    token,
    body: { name: 'Billing rework' },
  });
  check('create project', namedProject.body.slug === 'billing-rework', namedProject.body.slug ?? '');

  const bySlug = await call(`/workspaces/${workspaceId}/projects?slug=billing-rework`, { token });
  check('a project resolves from its slug', bySlug.body.id === namedProject.body.id);

  const created = await call(`/projects/${projectId}/plans`, {
    method: 'POST',
    token,
    body: { title: 'Smoke plan' },
  });
  const planId = created.body.id;
  check('create plan', typeof planId === 'string');

  // The canvas is addressed by plan id alone, so this is the only thing that
  // tells it which workspace it is in and what else it can move to.
  const nav = await call(`/plans/${planId}/navigation`, { token });
  check('a plan knows its workspace', nav.body.workspace?.id === workspaceId, nav.body.workspace?.slug ?? '');
  check('and which project holds it', nav.body.projectId === projectId);
  check(
    'and lists the sibling plans it can move to',
    nav.body.projects?.some((project) =>
      project.plans.some((plan) => plan.id === planId && plan.title === 'Smoke plan'),
    ) === true,
    `${nav.body.projects?.length ?? 0} projects`,
  );
  check(
    'navigation carries no plan documents',
    JSON.stringify(nav.body).length < 4000 && !JSON.stringify(nav.body).includes('"snapshot"'),
    `${JSON.stringify(nav.body).length} bytes`,
  );

  section('operations');
  const batch = await call(`/plans/${planId}/ops`, {
    method: 'POST',
    token,
    body: {
      ops: [
        { op: 'upsert_node', node: { slug: 'foundation', title: 'Foundation', kind: 'group' } },
        { op: 'upsert_node', node: { slug: 'database', title: 'Database', status: 'done' } },
        { op: 'upsert_node', node: { slug: 'auth', title: 'Auth', body: 'Email first.' } },
        { op: 'upsert_edge', edge: { kind: 'contains', from: 'foundation', to: 'database' } },
        { op: 'upsert_edge', edge: { kind: 'contains', from: 'foundation', to: 'auth' } },
        { op: 'upsert_edge', edge: { kind: 'depends_on', from: 'auth', to: 'database' } },
      ],
    },
  });
  check('batch applied', batch.body.nodes?.length === 3, `${batch.body.nodes?.length} nodes`);
  check(
    'server placed every node',
    batch.body.nodes?.every((node) => node.position !== null),
    'agents declare structure, the server places it',
  );

  const repeated = await call(`/plans/${planId}/ops`, {
    method: 'POST',
    token,
    body: { ops: [{ op: 'upsert_edge', edge: { kind: 'depends_on', from: 'auth', to: 'database' } }] },
  });
  check('repeating an edge does not duplicate it', repeated.body.edges?.length === 3);

  const rejected = await call(`/plans/${planId}/ops`, {
    method: 'POST',
    token,
    body: {
      ops: [
        { op: 'upsert_node', node: { slug: 'orphan', title: 'Orphan' } },
        { op: 'upsert_edge', edge: { from: 'orphan', to: 'ghost' } },
      ],
    },
  });
  check('an invalid batch is refused with 400', rejected.status === 400, rejected.body.message ?? '');
  const after = await call(`/plans/${planId}`, { token });
  check('and nothing from it was kept', !after.body.nodes.some((node) => node.slug === 'orphan'));

  section('history');
  // Written from the difference between two versions of the document, so it has
  // to catch a batch of ops as surely as it catches a keystroke.
  const history = await call(`/plans/${planId}/changes`, { token });
  const kinds = (history.body ?? []).map((entry) => entry.kind);
  check('the plan remembers what was done to it', kinds.length > 0, kinds.slice(0, 6).join(', '));
  check('including the nodes that were added', kinds.includes('node.added'));
  check('and the connections drawn between them', kinds.includes('edge.added'));
  check(
    'and says who did it',
    (history.body ?? []).every((entry) => entry.by?.name === 'Smoke'),
    history.body?.[0]?.by?.name ?? 'nobody',
  );
  check(
    'moving is one entry, not one per node',
    kinds.filter((kind) => kind === 'plan.arranged').length <= 1,
    `${kinds.filter((kind) => kind === 'plan.arranged').length} arrange entries`,
  );

  section('export');
  const zip = await call(`/plans/${planId}/export`, { token, raw: true });
  const bytes = new Uint8Array(await zip.arrayBuffer());
  check('zip downloads', zip.status === 200 && bytes.length > 0, `${bytes.length} bytes`);
  check('it is a zip', bytes[0] === 0x50 && bytes[1] === 0x4b);
  check(
    'named after the plan',
    (zip.headers.get('content-disposition') ?? '').includes('smoke-plan.zip'),
  );

  section('mcp');
  const key = await call('/auth/api-keys', { method: 'POST', token, body: { name: 'smoke' } });
  check('api key issued once', typeof key.body.key === 'string');
  check('a key belongs to the account, not a workspace', key.body.workspaceId === undefined);

  const mcp = async (payload) => {
    const response = await fetch(`${API}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${key.body.key}`,
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  };

  let mcpId = 100;
  const callTool = async (name, args) => {
    mcpId += 1;
    const response = await mcp({
      jsonrpc: '2.0',
      id: mcpId,
      method: 'tools/call',
      params: { name, arguments: args },
    });
    return response.result?.content?.[0]?.text ?? JSON.stringify(response.error ?? {});
  };

  const tools = await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const names = (tools.result?.tools ?? []).map((tool) => tool.name).sort();
  check('tools/list', names.length === 11, names.join(', '));
  check('trace is offered', names.includes('trace'));

  const second = await call('/workspaces', { method: 'POST', token, body: { name: 'Second' } });
  check('a second workspace exists', typeof second.body.slug === 'string', second.body.slug ?? '');
  check(
    'no tool accepts a position',
    JSON.stringify(tools.result?.tools ?? []).includes('position') === false,
  );
  check(
    'an unknown key is refused',
    (
      await fetch(`${API}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sp_nonsense' },
        body: '{}',
      })
    ).status === 401,
  );

  const listedWorkspaces = await mcp({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'list_workspaces', arguments: {} },
  });
  const seen = listedWorkspaces.result?.content?.[0]?.text ?? '';
  check(
    'one key reaches every workspace its owner belongs to',
    seen.includes(second.body.slug) && seen.includes(workspaces.body[0]?.slug ?? '#'),
    seen.replace(/\n/g, ' | '),
  );

  const listedProjects = await mcp({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'list_projects', arguments: {} },
  });
  check(
    'list_projects',
    (listedProjects.result?.content?.[0]?.text ?? '').includes('billing-rework'),
  );

  const ambiguous = await mcp({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'create_plan', arguments: { title: 'Which one?', nodes: [], edges: [] } },
  });
  check(
    'with several workspaces it asks which, and names them',
    (ambiguous.result?.content?.[0]?.text ?? '').includes('name one with the workspace argument'),
  );

  const drawn = await mcp({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'create_plan',
      arguments: {
        title: 'Drawn by an agent',
        workspace: workspaces.body[0]?.slug,
        projectSlug: 'billing-rework',
        nodes: [
          { slug: 'ingest', title: 'Ingest' },
          { slug: 'serve', title: 'Serve' },
        ],
        edges: [{ kind: 'depends_on', from: 'serve', to: 'ingest' }],
      },
    },
  });
  const drawnText = drawn.result?.content?.[0]?.text ?? '';
  check('create_plan', drawnText.includes('with 2 nodes'));
  // An agent has to be able to say where the thing it drew can be looked at.
  check('and it says where to look', drawnText.includes('/plan/'), drawnText.split('\n')[1] ?? '');

  const drawnId = /Created plan (\S+) with/.exec(drawnText)?.[1] ?? '';
  const wrongTitle = await mcp({
    jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: { name: 'delete_plan', arguments: { planId: drawnId, confirmTitle: 'Not its name' } },
  });
  check(
    'delete_plan refuses a title that does not match',
    (wrongTitle.result?.content?.[0]?.text ?? '').includes('Nothing was deleted'),
  );

  const deleted = await mcp({
    jsonrpc: '2.0', id: 7, method: 'tools/call',
    params: { name: 'delete_plan', arguments: { planId: drawnId, confirmTitle: 'Drawn by an agent' } },
  });
  check('delete_plan removes it once the title matches',
    (deleted.result?.content?.[0]?.text ?? '').includes('Deleted'));

  const newProject = await mcp({
    jsonrpc: '2.0', id: 8, method: 'tools/call',
    params: {
      name: 'create_project',
      arguments: { name: 'Drawn by an agent', workspace: workspaces.body[0]?.slug },
    },
  });
  check('create_project',
    (newProject.result?.content?.[0]?.text ?? '').includes('drawn-by-an-agent'),
    newProject.result?.content?.[0]?.text ?? '');

  section('following a flow');
  // The reading tool the whole thing exists for: answer with the thread, not
  // the document.
  const flowPlan = await callTool('create_plan', {
    title: 'Sign-in flow',
    workspace: workspaces.body[0]?.slug,
    nodes: [
      { slug: 'login-page', title: 'Login page' },
      { slug: 'login-api', title: 'POST /api/login' },
      { slug: 'users', title: 'users table' },
    ],
    edges: [
      { kind: 'flows_to', from: 'login-page', to: 'login-api', via: 'click Sign in', carries: '{ email, password }' },
      { kind: 'flows_to', from: 'login-api', to: 'users', via: 'select by email' },
      { kind: 'flows_to', from: 'users', to: 'login-api', carries: '{ id, hash }' },
      { kind: 'flows_to', from: 'login-api', to: 'login-page', carries: '{ token }' },
    ],
  });
  const flowPlanId = (flowPlan.match(/\/plan\/([a-z0-9]+)/) ?? [])[1];
  check('a plan of flows is accepted', typeof flowPlanId === 'string', flowPlanId ?? flowPlan.slice(0, 80));

  const traced = await callTool('trace', { planId: flowPlanId, from: 'Login page' });
  check('trace finds a node by its title', traced.includes('Login page'));
  check('and says what set each hop off', traced.includes('click Sign in'), traced.split('\n')[3] ?? '');
  check('and what it carried', traced.includes('{ email, password }'));
  check('and stops where the flow comes back on itself', traced.includes('[loops back]'));

  const upstream = await callTool('trace', {
    planId: flowPlanId,
    from: 'users',
    direction: 'upstream',
  });
  check('trace walks the other way too', upstream.includes('login-page'));

  const missing = await callTool('trace', { planId: flowPlanId, from: 'nothing-like-this' });
  check('and says so when the name is unknown', missing.toLowerCase().includes('nothing in this plan'));

  await callTool('delete_plan', { planId: flowPlanId, confirmTitle: 'Sign-in flow' });

  section('sharing');
  const share = await call(`/plans/${planId}/share`, { method: 'POST', token, body: {} });
  const shared = await call(`/share/${share.body.token}`);
  check('a share link reads without a session', shared.body.title === 'Smoke plan');

  const other = await call('/auth/register', {
    method: 'POST',
    body: {
      email: `smoke-other-${Date.now()}@example.invalid`,
      name: 'Other',
      password: 'correct-horse-battery',
    },
  });
  const denied = await call(`/plans/${planId}`, { token: other.body.accessToken });
  check('another account cannot read the plan', denied.status === 404, `status ${denied.status}`);
  const deniedNav = await call(`/plans/${planId}/navigation`, { token: other.body.accessToken });
  check('nor list what is around it', deniedNav.status === 404, `status ${deniedNav.status}`);

  section('workspace management');
  const invite = await call(`/workspaces/${workspaceId}/invites`, {
    method: 'POST',
    token,
    body: { role: 'EDITOR' },
  });
  check('an invitation link is issued', (invite.body.url ?? '').includes('/invite/'));

  const members = await call(`/workspaces/${workspaceId}/members`, { token });
  check('the owner is a member', members.body[0]?.role === 'OWNER', members.body[0]?.user?.email);

  const renamed = await call(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    token,
    body: { name: 'Renamed workspace' },
  });
  check('rename a workspace', renamed.body.name === 'Renamed workspace');
  check(
    'the address does not change with the name',
    renamed.body.slug === workspaces.body[0]?.slug,
    renamed.body.slug,
  );

  const badDelete = await call(`/workspaces/${workspaceId}`, {
    method: 'DELETE',
    token,
    body: { confirm: 'not the name' },
  });
  check('deleting needs the name typed exactly', badDelete.status === 400);

  section('account');
  const profile = await call('/auth/me', { method: 'PATCH', token, body: { name: 'Renamed' } });
  // A 1×1 PNG. The browser sends what it drew on a canvas; this stands in for it.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const avatar = await call('/auth/me/avatar', {
    method: 'POST',
    token,
    bytes: png,
    contentType: 'image/png',
  });
  check('set a picture', (avatar.body.avatarUrl ?? '').startsWith('/api/avatars/'), avatar.body.avatarUrl ?? `status ${avatar.status}`);

  const served = await call((avatar.body.avatarUrl ?? '').replace('/api', ''), { raw: true });
  const servedBytes = Buffer.from(await served.arrayBuffer());
  check('and it is served back', served.status === 200 && servedBytes.equals(png), `${servedBytes.length} bytes`);
  check('as an image nothing is allowed to sniff', served.headers.get('x-content-type-options') === 'nosniff', served.headers.get('content-type') ?? '');

  const notAnImage = await call('/auth/me/avatar', {
    method: 'POST',
    token,
    bytes: Buffer.from('<script>alert(1)</script>'),
    contentType: 'image/png',
  });
  check('anything that is not a PNG is refused', notAnImage.status === 400, `status ${notAnImage.status}`);

  const cleared = await call('/auth/me/avatar', { method: 'DELETE', token });
  check('and a picture can be taken down', cleared.body.ok === true);

  check('rename yourself', profile.body.name === 'Renamed');

  const sessionsBefore = await call('/auth/sessions', { token });
  check(
    'your sessions are listed',
    Array.isArray(sessionsBefore.body) && sessionsBefore.body.length >= 1,
    `${sessionsBefore.body.length ?? 0} session(s)`,
  );

  const wrongPassword = await call('/auth/password', {
    method: 'POST',
    token,
    body: { currentPassword: 'not-it', newPassword: 'a-new-long-password' },
  });
  check('a wrong current password is refused', wrongPassword.status === 401);

  const changed = await call('/auth/password', {
    method: 'POST',
    token,
    body: { currentPassword: 'correct-horse-battery', newPassword: 'a-new-long-password' },
  });
  check('change your password', changed.body.ok === true, `status ${changed.status}`);

  // Signing in has its own tight allowance, and the throttling section below
  // spends it deliberately. A run that follows another too closely inherits
  // that: waiting is the correct behaviour, not a failure.
  const signIn = async (password) => {
    let attempt = await call('/auth/login', { method: 'POST', body: { email, password } });
    if (attempt.status === 429) {
      console.log('  … the sign-in allowance is spent; waiting for the window');
      await wait(62_000);
      attempt = await call('/auth/login', { method: 'POST', body: { email, password } });
    }
    return attempt;
  };

  const reLogin = await signIn('a-new-long-password');
  check(
    'the new password works',
    typeof reLogin.body.accessToken === 'string',
    `status ${reLogin.status}: ${reLogin.body.message ?? ''}`,
  );
  const oldPassword = await signIn('correct-horse-battery');
  check('the old one does not', oldPassword.status === 401, `status ${oldPassword.status}`);

  section('rate limiting');
  // The allowance is per credential-less client, so a burst of bad sign-ins from
  // one address has to be turned away before it becomes a password guessing run.
  let sawTooMany = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await call('/auth/login', {
      method: 'POST',
      body: { email, password: `guess-${attempt}` },
    });
    if (response.status === 429) {
      sawTooMany = true;
      break;
    }
  }
  check('repeated sign-in attempts are throttled', sawTooMany, '429 within 25 tries');

  section('collaboration');
  const open = (label) => {
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: `${COLLAB}/${planId}`,
      name: planId,
      document: doc,
      token,
      onAuthenticationFailed: () => check(`${label} authenticated`, false),
    });
    return { doc, provider };
  };

  const a = open('A');
  const b = open('B');

  const synced = await Promise.race([
    (async () => {
      for (let i = 0; i < 200; i += 1) {
        if (a.provider.isSynced && b.provider.isSynced) return true;
        await wait(100);
      }
      return false;
    })(),
    wait(25_000).then(() => false),
  ]);
  check('two clients sync', synced);

  if (synced) {
    check('the document loaded from the database', readPlanDoc(a.doc).doc.nodes.length === 3);

    applyOps(
      a.doc,
      planOpsSchema.parse([
        { op: 'upsert_node', node: { slug: 'live', title: 'Written by A', status: 'planned' } },
      ]),
      'smoke',
    );
    let received = false;
    for (let i = 0; i < 60; i += 1) {
      if (readPlanDoc(b.doc).doc.nodes.some((node) => node.slug === 'live')) {
        received = true;
        break;
      }
      await wait(100);
    }
    check("one client's write reaches the other", received);

    const bodyOf = (doc) => doc.getMap('nodes').get('live').get('body');
    bodyOf(a.doc).insert(0, 'from A. ');
    await wait(400);
    bodyOf(b.doc).insert(bodyOf(b.doc).length, 'from B.');
    await wait(1000);
    const merged = readPlanDoc(a.doc).doc.nodes.find((node) => node.slug === 'live')?.body;
    check('concurrent edits to one body merge', merged === 'from A. from B.', `"${merged}"`);

    // Past the persist debounce, the projection the rest of the system reads
    // must have caught up.
    await wait(5000);
    const persisted = await call(`/plans/${planId}`, { token });
    check(
      'the CRDT reached the database',
      persisted.body.nodes?.some((node) => node.slug === 'live'),
    );
  }

  a.provider.destroy();
  b.provider.destroy();

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nsmoke check could not run:', error);
  process.exit(1);
});
