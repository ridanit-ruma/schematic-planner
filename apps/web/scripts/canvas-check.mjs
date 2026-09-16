/**
 * Drives the canvas in a real browser against a running instance.
 *
 * Three defects reached a running server without a single test noticing: the
 * canvas rendered nothing on a shared link because its container had no height,
 * containers were drawn on top of their own children, and a container's handles
 * sat behind the edge layer so a node could not be dragged into a group at all.
 * None of that is visible from the protocol, so this drives the gestures.
 *
 *   CANVAS_CHECK_URL=http://127.0.0.1:8443 \
 *   CANVAS_CHECK_EMAIL=… CANVAS_CHECK_PASSWORD=… \
 *   pnpm --filter @schematic/web canvas-check
 *
 * Needs puppeteer-core and a browser. Both are optional, so the script says
 * what is missing rather than failing obscurely, and it finds the browser
 * itself rather than naming one path that has to be true everywhere.
 */
import { accessSync, constants } from 'node:fs';

const BASE = (process.env['CANVAS_CHECK_URL'] ?? 'http://127.0.0.1:8443').replace(/\/+$/, '');
const EMAIL = process.env['CANVAS_CHECK_EMAIL'] ?? 'demo@schematic.local';
const PASSWORD = process.env['CANVAS_CHECK_PASSWORD'] ?? 'schematic-demo-2026';
/**
 * A browser to drive, from CHROME_PATH or from whatever the machine has.
 *
 * There is no one path worth hard-coding: this has already run against a
 * distribution Chromium, the one bundled inside Burp Suite, and a NixOS
 * Firefox, and a default naming any of those is wrong on the other two. Chrome
 * comes first because the check was written against it and its remote protocol
 * is the better supported of the two; Firefox is driven over WebDriver BiDi,
 * takes none of Chrome's flags, and refuses a pointer outside the window where
 * Chrome clamps it — hence the differences guarded further down.
 */
function findBrowser() {
  const named = process.env['CHROME_PATH'];
  if (named !== undefined && named.trim() !== '') return named;

  const names = [
    'chromium',
    'chromium-browser',
    'google-chrome-stable',
    'google-chrome',
    'brave',
    'firefox',
  ];
  const directories = (process.env['PATH'] ?? '').split(':').filter((entry) => entry !== '');

  for (const name of names) {
    for (const directory of directories) {
      const candidate = `${directory}/${name}`;
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Not here; try the next place on the path.
      }
    }
  }
  return null;
}

const CHROME = findBrowser();

if (CHROME === null) {
  console.error(
    'No browser to drive. Install one of chromium, google-chrome or firefox,\n' +
      'or point CHROME_PATH at the executable of one you already have.',
  );
  process.exit(1);
}

console.log(`driving ${CHROME}`);

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error(
    'puppeteer-core is not installed. pnpm --filter @schematic/web add -D puppeteer-core',
  );
  process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail === '' ? '' : `  ${detail}`}`);
};

// Firefox is driven over WebDriver BiDi and takes none of Chrome's flags, so
// the browser is chosen from the path rather than a second variable to keep in
// step with it.
const isFirefox = /firefox/i.test(CHROME);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  ...(isFirefox
    ? { browser: 'firefox' }
    : { args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }),
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
page.on('pageerror', (error) => console.log(`  [page error] ${error.message}`.slice(0, 160)));

try {
  console.log('\nsign in');
  // The smoke check deliberately exhausts the sign-in allowance for its address.
  // Running the two in sequence would otherwise fail here for a reason that has
  // nothing to do with the canvas.
  let throttled = false;
  page.on('response', (r) => {
    if (r.url().endsWith('/auth/login') && r.status() === 429) throttled = true;
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    throttled = false;
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await wait(2500);
    if (!page.url().endsWith('/login')) break;
    await page.type('input[type=email]', EMAIL);
    await page.type('input[type=password]', PASSWORD);
    await page.click('button[type=submit]');
    await wait(3500);
    if (!page.url().endsWith('/login')) break;
    if (!throttled) break;
    console.log('  rate limited; waiting for the window to pass');
    await wait(31_000);
  }
  check('signed in', !page.url().endsWith('/login'), throttled ? 'still rate limited' : page.url());

  // Wrapping a link in a tooltip hands it the tooltip's props, and a className
  // written as a function is merged into nonsense — the whole rail lost its
  // styling that way once, silently.
  await page
    .waitForSelector('aside nav a[href^="/workspace/"]', { timeout: 8000 })
    .catch(() => null);
  const railRows = await page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll(
        'aside nav a[href="/recent"], aside nav a[href^="/workspace/"]',
      ),
    ];
    return {
      rows: rows.length,
      tallEnough: rows.filter((row) => row.getBoundingClientRect().height >= 28).length,
      active: rows.filter((row) => row.classList.contains('active')).length,
      // The workspace is switched from its name at the head of the trail, not
      // from a second control in the rail.
      switcher: document.querySelector('header button[aria-label$="switch workspace"]') !== null,
      railSwitcher: document.querySelector('aside button[aria-label$="switch workspace"]') !== null,
      account: document.querySelector('aside button[aria-label="Account"]') !== null,
    };
  });
  check(
    'the rail draws its rows',
    railRows.rows > 0 && railRows.tallEnough === railRows.rows,
    `${railRows.tallEnough}/${railRows.rows} at full height`,
  );
  check('and marks exactly one of them', railRows.active === 1, `${railRows.active} active`);
  // The workspace is switched from its own name; the logo above it is the
  // product, and the account keeps its own menu at the foot of the rail.
  check('the workspace name in the trail is the switcher', railRows.switcher);
  check('and there is not a second one in the rail', !railRows.railSwitcher);
  check('and the account has its own menu', railRows.account);

  check(
    'the application opens on what you were working on',
    page.url().endsWith('/recent'),
    page.url(),
  );

  console.log('\nthe canvas');
  // Workspace, then project, then plan — the hierarchy the addresses describe.
  const projects = await page.$$eval('a[href*="/project/"]', (list) =>
    list.map((a) => a.getAttribute('href')).filter((h) => h !== null),
  );
  check('projects are listed in the workspace', projects.length > 0, projects.join(', '));

  // A workspace usually has an empty project as well as a used one, so take the
  // first that actually holds a plan rather than assuming an order.
  let planHref = null;
  for (const projectHref of projects) {
    await page.goto(`${BASE}${projectHref}`, { waitUntil: 'domcontentloaded' });
    // The app mints an access token before it can list anything, so waiting a
    // fixed moment here reports an empty project whenever the machine is busy.
    await page.waitForSelector('a[href^="/plan/"]', { timeout: 8000 }).catch(() => null);
    planHref = await page
      .$eval('a[href^="/plan/"]', (a) => a.getAttribute('href'))
      .catch(() => null);
    if (planHref !== null) break;
  }
  check(
    'a plan is listed in a project',
    planHref !== null,
    planHref ??
      (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 200),
  );
  if (planHref === null) throw new Error('no plan to open — seed one first');

  const planId = planHref.split('/').pop();
  await page.goto(`${BASE}${planHref}`, { waitUntil: 'domcontentloaded' });
  await wait(4000);

  const nodes = await page.$$eval('.react-flow__node', (list) => list.length);
  check('nodes render', nodes > 0, `${nodes} nodes`);

  const height = await page.$eval('.react-flow', (el) => el.getBoundingClientRect().height);
  check('the canvas has height', height > 200, `${Math.round(height)}px`);

  // Measured in canvas units, not screen pixels: a plan large enough to be
  // fitted at a small scale would otherwise report that it has no groups.
  const containers = await page.evaluate(() => {
    const zoom = Number(
      /scale\(([0-9.]+)\)/.exec(
        document.querySelector('.react-flow__viewport')?.style.transform ?? '',
      )?.[1] ?? '1',
    );
    return [...document.querySelectorAll('.react-flow__node')]
      .filter((node) => node.getBoundingClientRect().width / zoom > 320)
      .map((node) => node.getAttribute('data-id'));
  });
  check(
    'at least one container is drawn at its own bounds',
    containers.length > 0,
    containers.join(', '),
  );

  console.log('\nreading it from a distance');
  // Two earlier attempts had the card change with the zoom — text dropped at a
  // threshold, then regrown in canvas units. A card is a drawing now: the same
  // at every distance, only nearer or further away.
  // One card, not the whole canvas: off-screen nodes are culled for speed, so
  // counting everything would report a difference that is only the viewport.
  const measure = (slug) =>
    page.evaluate((id) => {
      const zoom = Number(
        /scale\(([0-9.]+)\)/.exec(
          document.querySelector('.react-flow__viewport')?.style.transform ?? '',
        )?.[1] ?? '1',
      );
      const node =
        id === null ? null : document.querySelector(`.react-flow__node[data-id="${id}"]`);
      const labels = [...(node?.querySelectorAll('p, span') ?? [])]
        .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
        .map((el) => getComputedStyle(el).fontSize);
      return { zoom, count: labels.length, sizes: labels.join(',') };
    }, slug ?? null);

  // Whatever sits nearest the middle stays on screen as the view moves in.
  const middle = await page.evaluate(() => {
    const centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let best = null;
    for (const node of document.querySelectorAll('.react-flow__node')) {
      const box = node.getBoundingClientRect();
      const away = Math.hypot(box.x + box.width / 2 - centre.x, box.y + box.height / 2 - centre.y);
      if (best === null || away < best.away) best = { away, id: node.getAttribute('data-id') };
    }
    return best?.id ?? null;
  });
  check('there is a card in the middle to watch', middle !== null, middle ?? '');

  const far = await measure(middle);
  for (let i = 0; i < 4; i += 1) {
    await page.click('.react-flow__controls-zoomin');
    await wait(180);
  }
  const near = await measure(middle);
  check(
    'moving in actually moved in',
    near.zoom > far.zoom * 1.8,
    `${far.zoom.toFixed(2)} -> ${near.zoom.toFixed(2)}`,
  );
  check(
    'the same card is drawn at both distances',
    far.count === near.count && far.count > 0,
    `${middle}: ${far.count} -> ${near.count}`,
  );
  check('and drawn at the same size', far.sizes === near.sizes, near.sizes.slice(0, 40));
  await page.click('.react-flow__controls-fitview');
  await wait(500);

  console.log('\nmoving between plans');
  const rail = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (aside === null) return null;
    return {
      workspace: aside.querySelector('a[href^="/workspace/"]')?.textContent?.trim() ?? '',
      current: aside.querySelector('[aria-current="page"]')?.textContent?.trim() ?? '',
      plans: aside.querySelectorAll('button[title]').length,
    };
  });
  check(
    'the rail names the workspace it belongs to',
    (rail?.workspace ?? '') !== '',
    rail?.workspace ?? 'no rail',
  );
  check('and marks the plan you are on', (rail?.current ?? '') !== '', rail?.current ?? '');
  check('and lists the plans you can move to', (rail?.plans ?? 0) > 0, `${rail?.plans ?? 0} plans`);

  console.log('\ngroups');
  /*
   * On a plan this check builds for itself. Three rounds of these assertions
   * failed against the demo data instead — each run left the groups somewhere
   * new, so what the next run picked up depended on what the last one did.
   */
  const token = await page.evaluate(async () => {
    const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!response.ok) return null;
    return (await response.json()).accessToken ?? null;
  });
  check('a token for the fixture', typeof token === 'string');

  const call = (path, init) =>
    page.evaluate(
      async ({ path: p, init: i, token: t }) => {
        const response = await fetch(`/api${p}`, {
          ...i,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
          ...(i?.body === undefined ? {} : { body: JSON.stringify(i.body) }),
        });
        return response.ok ? await response.json() : { error: response.status };
      },
      { path, init: init ?? {}, token },
    );

  const workspaces = await call('/workspaces');
  const projectList = await call(`/workspaces/${workspaces[0].id}/projects`);
  const fixture = await call(`/projects/${projectList[0].id}/plans`, {
    method: 'POST',
    body: {
      title: `Canvas check ${Date.now()}`,
      spec: {
        title: 'Canvas check',
        description: 'Built and removed by the browser check.',
        nodes: [
          { slug: 'alpha', title: 'Alpha' },
          { slug: 'a-one', title: 'A one' },
          { slug: 'a-two', title: 'A two' },
          { slug: 'beta', title: 'Beta' },
          { slug: 'b-one', title: 'B one' },
          { slug: 'loose', title: 'Loose' },
        ],
        edges: [
          { kind: 'contains', from: 'alpha', to: 'a-one' },
          { kind: 'contains', from: 'alpha', to: 'a-two' },
          { kind: 'contains', from: 'beta', to: 'b-one' },
          { kind: 'flows_to', from: 'loose', to: 'b-one', via: 'click Save', carries: '{ id }' },
          { kind: 'flows_to', from: 'loose', to: 'a-one', via: 'click Delete', carries: '{ id }' },
          {
            kind: 'flows_to',
            from: 'loose',
            to: 'a-two',
            via: 'on load',
            carries: 'the current filter',
          },
        ],
      },
    },
  });
  check('a plan to drive', typeof fixture.id === 'string', fixture.error ?? fixture.id);
  await call(`/plans/${fixture.id}/layout`, { method: 'POST', body: { scope: 'all' } });

  console.log('\nan invitation');
  const invited = await call(`/workspaces/${workspaces[0].id}/invites`, {
    method: 'POST',
    body: { role: 'VIEWER', expiresInDays: 1 },
  });
  // createInvite answers with the whole link, not the token: the token is the
  // last segment of it.
  const inviteToken = typeof invited.url === 'string' ? invited.url.split('/').pop() : null;
  check('an invitation can be minted', typeof inviteToken === 'string' && inviteToken !== '');

  if (typeof inviteToken === 'string' && inviteToken !== '') {
    try {
      // Signed out, the page still has to say what the invitation is for.
      const anonymous = await browser.createBrowserContext();
      const visitor = await anonymous.newPage();
      await visitor.goto(`${BASE}/invite/${inviteToken}`, { waitUntil: 'domcontentloaded' });
      await wait(2500);
      const signedOut = await visitor.evaluate(() => document.body.innerText);
      check(
        'it names the workspace without a session',
        signedOut.includes('invited you to'),
        signedOut.slice(0, 60).replace(/\n/g, ' '),
      );
      check('and offers a way in rather than a spinner', signedOut.includes('Sign in to accept'));
      await anonymous.close();

      // Signed in, nothing is joined until the button is pressed.
      await page.goto(`${BASE}/invite/${inviteToken}`, { waitUntil: 'domcontentloaded' });
      await wait(2500);
      const offered = await page.evaluate(() => document.body.innerText);
      // Accept/Decline is not reachable here: the gate has exactly one account,
      // and it already owns the workspace it just invited itself into, so this
      // is the already-a-member rendering — an offer to open it, not join it.
      check(
        'signed in as a member already, it offers to open the workspace rather than join it',
        offered.includes('You are already in this workspace') &&
          offered.includes(`Open ${workspaces[0].name}`) &&
          !offered.includes('Accept'),
      );

      // Still listed means still open: Task 5 drops anything taken or turned down.
      // Matched back to the token this section minted, not to just any open
      // invitation in the demo workspace — otherwise this passes whenever the
      // workspace happens to have an unrelated invitation sitting open.
      const before = await call(`/workspaces/${workspaces[0].id}/invites`);
      const stillOpen = Array.isArray(before)
        ? before.find((entry) => entry.prefix !== '' && inviteToken.startsWith(entry.prefix))
        : undefined;
      check('and has joined nobody yet', stillOpen !== undefined);
    } finally {
      // Withdraw it no matter what went wrong above, the way the fixture below
      // destroys itself in its own finally. Looked up fresh here rather than
      // reused from the try, since a throw partway through the try would
      // otherwise skip cleanup and leak an open invitation into the demo
      // workspace. The create response carries the link, not the row's id, so
      // the row this minted is matched back to it by the prefix stored
      // alongside the token's hash. `prefix === ''` is the schema default for
      // rows created before that column existed, so it must not match a
      // startsWith('') that is true of every token — that would delete an
      // unrelated live invitation instead of the one this section made.
      const open = await call(`/workspaces/${workspaces[0].id}/invites`);
      const minted = Array.isArray(open)
        ? open.find((entry) => entry.prefix !== '' && inviteToken.startsWith(entry.prefix))
        : undefined;
      check('and it can be withdrawn', minted !== undefined);
      if (minted !== undefined) {
        await call(`/workspaces/${workspaces[0].id}/invites/${minted.id}`, { method: 'DELETE' });
      }
    }
  }

  /**
   * What one canvas unit is worth on screen right now.
   *
   * A drag written in screen pixels means a different distance in the drawing
   * at every zoom, and the canvas fits the whole plan — so a section that adds
   * nodes changes what the section after it is actually dragging.
   */
  const zoomNow = () =>
    page.evaluate(() =>
      Number(
        /scale\(([0-9.]+)\)/.exec(
          document.querySelector('.react-flow__viewport')?.style.transform ?? '',
        )?.[1] ?? '1',
      ),
    );

  /**
   * Where to take hold of a box.
   *
   * Its label band, at the middle of it. The corners look like the obvious
   * place and are not: a box is drawn tight around its contents, so the room
   * between its edge and the first child is twenty canvas units — which at a
   * zoomed-out fit is a handful of screen pixels, and an offset written in
   * screen pixels lands on the child instead and drags that.
   */
  const bandOf = (rect) =>
    rect === null ? { x: -1, y: -1 } : { x: rect.x + rect.width / 2, y: rect.y + 6 };

  const rectOf = (slug) =>
    page
      .$eval(`.react-flow__node[data-id="${slug}"]`, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })
      .catch(() => null);
  const countIn = (slug) =>
    page
      .$eval(`.react-flow__node[data-id="${slug}"] span:last-child`, (el) =>
        Number(el.textContent?.trim() ?? '0'),
      )
      .catch(() => 0);
  // A pointer outside the window is refused outright by Firefox where Chrome
  // clamps it, and a drag that leaves by a pixel is not what any of these
  // checks are about. Both ends are kept just inside.
  const VIEW = { width: 1600, height: 1000 };
  const onScreen = (point) => ({
    x: Math.min(Math.max(point.x, 2), VIEW.width - 2),
    y: Math.min(Math.max(point.y, 2), VIEW.height - 2),
  });
  const drag = async (rawFrom, rawTo) => {
    const from = onScreen(rawFrom);
    const to = onScreen(rawTo);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 10 });
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await wait(900);
  };
  const inside = (child, box) =>
    child !== null &&
    box !== null &&
    child.x >= box.x - 1 &&
    child.y >= box.y - 1 &&
    child.x + child.width <= box.x + box.width + 1 &&
    child.y + child.height <= box.y + box.height + 1;
  const reopen = async () => {
    /*
     * The plan arrives over a socket, not with the page, and a slow first load
     * is the common case rather than a fault — after the invitation section
     * this is a cold connection and a fresh document.
     *
     * So it is watched rather than restarted. Reloading interrupts a document
     * that is still on its way, which made an eager retry the reason the plan
     * never arrived: every few seconds the load began again from nothing. It
     * now waits up to twenty seconds, returning the moment anything is drawn,
     * and only then opens the page again.
     */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt === 0) {
        await page.goto(`${BASE}/plan/${fixture.id}`, { waitUntil: 'domcontentloaded' });
      } else {
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      for (let waited = 0; waited < 20; waited += 1) {
        await wait(1000);
        const drawn = await page.$$eval('.react-flow__node', (list) => list.length).catch(() => 0);
        if (drawn > 0) {
          // A frame for the browser to lay the new nodes out before anything
          // measures one.
          await wait(600);
          return;
        }
      }
      console.log('  the plan did not arrive; opening it again');
    }
    // Said out loud. Every check after this reads an empty canvas, and without
    // it they blame whatever they were about rather than the socket.
    check('the plan arrived', false, 'gave up reopening it');
  };

  try {
    await reopen();
    check(
      'the fixture draws its groups as boundaries',
      inside(await rectOf('a-one'), await rectOf('alpha')),
    );
    check('alpha holds two', (await countIn('alpha')) === 2, String(await countIn('alpha')));

    // A group is picked up anywhere on it; its contents are drawn above it.
    const alphaWas = await rectOf('alpha');
    const oneWas = await rectOf('a-one');
    await drag(
      { x: alphaWas.x + alphaWas.width - 30, y: alphaWas.y + alphaWas.height - 12 },
      { x: alphaWas.x + alphaWas.width - 30 + 150, y: alphaWas.y + alphaWas.height - 12 + 120 },
    );
    const alphaIs = await rectOf('alpha');
    const oneIs = await rectOf('a-one');
    check(
      'dragging a group moves it',
      Math.abs(alphaIs.x - alphaWas.x) > 60,
      `${Math.round(alphaIs.x - alphaWas.x)}px`,
    );
    check(
      'and carries what it holds',
      // It has to have moved at all: with a shift of nothing every difference
      // below is zero and the check passes without testing anything.
      Math.abs(oneIs.x - oneWas.x) > 40 &&
        Math.abs(oneIs.x - oneWas.x - (alphaIs.x - alphaWas.x)) < 2 &&
        Math.abs(oneIs.y - oneWas.y - (alphaIs.y - alphaWas.y)) < 2,
      `child ${Math.round(oneIs.x - oneWas.x)},${Math.round(oneIs.y - oneWas.y)}`,
    );

    await reopen();
    check(
      'and the move is what everyone else sees',
      inside(await rectOf('a-one'), await rectOf('alpha')),
    );

    // Out of the group, then back into it.
    const box = await rectOf('alpha');
    const one = await rectOf('a-one');
    await drag(
      { x: one.x + one.width / 2, y: one.y + one.height / 2 },
      { x: box.x + box.width + 300, y: box.y + 30 },
    );
    await reopen();
    check(
      'dragging a node out of a group leaves it',
      (await countIn('alpha')) === 1,
      String(await countIn('alpha')),
    );
    check('and it is drawn outside the box', !inside(await rectOf('a-one'), await rectOf('alpha')));

    const back = await rectOf('alpha');
    const away = await rectOf('a-one');
    await drag(
      { x: away.x + away.width / 2, y: away.y + away.height / 2 },
      { x: back.x + back.width / 2, y: back.y + back.height - 30 },
    );
    await reopen();
    check(
      'dropping it back in joins it again',
      (await countIn('alpha')) === 2,
      String(await countIn('alpha')),
    );
    check(
      'and nothing is left straddling the edge',
      inside(await rectOf('a-one'), await rectOf('alpha')),
    );

    console.log('\na group inside a group');
    const alphaBox = await rectOf('alpha');
    const betaBox = await rectOf('beta');
    // Squarely onto the other, because the rule asks what the two have in
    // common and a box clipping a corner of another is not a box put inside it.
    await drag(bandOf(betaBox), {
      x: alphaBox.x + alphaBox.width / 2,
      y: alphaBox.y + alphaBox.height / 2 - betaBox.height / 2 + 6,
    });
    await reopen();
    check(
      'a group can be dropped into a group',
      inside(await rectOf('beta'), await rectOf('alpha')),
    );
    check(
      'the inner group still holds its own',
      inside(await rectOf('b-one'), await rectOf('beta')),
    );
    check(
      'and the outer one counts it',
      (await countIn('alpha')) === 3,
      String(await countIn('alpha')),
    );

    const outerWas = await rectOf('alpha');
    const innerWas = await rectOf('beta');
    const deepWas = await rectOf('b-one');
    // By its own label band, which is the one part of a box no child is under.
    const outerGrab = bandOf(outerWas);
    await drag(outerGrab, { x: outerGrab.x - 130, y: outerGrab.y + 90 });
    const shift = {
      x: (await rectOf('alpha')).x - outerWas.x,
      y: (await rectOf('alpha')).y - outerWas.y,
    };
    const innerIs = await rectOf('beta');
    const deepIs = await rectOf('b-one');
    check(
      'moving the outer group carries the inner one and its contents',
      Math.abs(shift.x) > 40 &&
        Math.abs(innerIs.x - innerWas.x - shift.x) < 2 &&
        Math.abs(deepIs.x - deepWas.x - shift.x) < 2 &&
        Math.abs(deepIs.y - deepWas.y - shift.y) < 2,
      `outer ${Math.round(shift.x)},${Math.round(shift.y)}`,
    );
    // What a flow carries has to be on the line. It is the whole of what the
    // connection says, and it was stored, exported and traced but never drawn.
    const written = await page.$$eval('.react-flow__edgelabel-renderer div', (list) =>
      list.map((el) => el.textContent?.trim() ?? '').filter((text) => text !== ''),
    );
    check(
      'what a flow carries is drawn on it',
      written.some((text) => text.includes('click Save')),
      written.slice(0, 3).join(' | '),
    );

    // Three flows out of one node used to write their notes at three midpoints
    // in the same corridor, on top of each other and on the cards beneath.
    //
    // Asked of a plan as layout left it. The sections above drag nodes around
    // by hand, and a note follows the line it is on, so after that they can
    // land on one another — that is what arranging a plan is for, and it is
    // not the promise being kept here.
    await call(`/plans/${fixture.id}/layout`, { method: 'POST', body: { scope: 'all' } });
    await reopen();
    const piled = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('.react-flow__edgelabel-renderer div')]
        .filter((el) => (el.textContent ?? '').trim() !== '')
        .map((el) => el.getBoundingClientRect());
      let overlapping = 0;
      for (let a = 0; a < rects.length; a += 1) {
        for (let b = a + 1; b < rects.length; b += 1) {
          const [one, other] = [rects[a], rects[b]];
          if (
            one.left < other.right &&
            other.left < one.right &&
            one.top < other.bottom &&
            other.top < one.bottom
          ) {
            overlapping += 1;
          }
        }
      }
      return { notes: rects.length, overlapping };
    });
    check(
      'and never on top of another note',
      piled.notes > 1 && piled.overlapping === 0,
      `${piled.notes} notes, ${piled.overlapping} overlapping`,
    );

    console.log('\nmaking a group');
    /*
     * The half that was missing. Whether a node was drawn as a box was inferred
     * from whether it already held one, so there was no first move: a box
     * appeared once it had contents, and contents could only be dragged into a
     * box. None of what follows was possible before.
     */
    const holds = async (from, to) => {
      const doc = await call(`/plans/${fixture.id}`);
      return (doc.nodes ?? []).length > 0
        ? (doc.edges ?? []).some(
            (edge) => edge.kind === 'contains' && edge.from === from && edge.to === to,
          )
        : false;
    };
    // Off-screen rather than a crash when the node is not there: a failed check
    // names itself and the run still reaches a verdict, where reading .x off
    // null ends the process with no verdict at all.
    const centreOf = (rect) =>
      rect === null ? { x: -1, y: -1 } : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    /** A drag that rests on what it is over before letting go. */
    const dragHolding = async (rawFrom, rawTo, holdMs) => {
      const from = onScreen(rawFrom);
      const to = onScreen(rawTo);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 10 });
      await page.mouse.move(to.x, to.y, { steps: 10 });
      if (holdMs > 0) await wait(holdMs);
      await page.mouse.up();
      await wait(900);
    };

    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          {
            op: 'upsert_node',
            node: {
              slug: 'boxy',
              kind: 'group',
              title: 'Boxy',
              position: { x: -900, y: 200 },
              pinned: true,
            },
          },
          {
            op: 'upsert_node',
            node: { slug: 'mk-one', title: 'Mk one', position: { x: -900, y: 700 }, pinned: true },
          },
          {
            op: 'upsert_node',
            node: { slug: 'mk-two', title: 'Mk two', position: { x: -500, y: 700 }, pinned: true },
          },
          {
            op: 'upsert_node',
            node: { slug: 'mk-three', title: 'Mk three', position: { x: -900, y: 950 }, pinned: true },
          },
          {
            op: 'upsert_node',
            node: { slug: 'mk-four', title: 'Mk four', position: { x: -1500, y: 200 }, pinned: true },
          },
          {
            op: 'upsert_node',
            node: { slug: 'mk-five', title: 'Mk five', position: { x: -1500, y: 500 }, pinned: true },
          },
        ],
      },
    });
    await reopen();

    const emptyBox = await rectOf('boxy');
    const aCard = await rectOf('mk-one');
    check(
      'a group that holds nothing is still drawn as a box',
      emptyBox !== null && aCard !== null && emptyBox.width > aCard.width * 1.2,
      `${Math.round(emptyBox?.width ?? 0)} against a card's ${Math.round(aCard?.width ?? 0)}`,
    );

    await dragHolding(centreOf(aCard), centreOf(emptyBox), 0);
    check('and a node dropped into it joins it on sight', await holds('boxy', 'mk-one'));
    await reopen();
    check('which is what everyone else sees', inside(await rectOf('mk-one'), await rectOf('boxy')));

    // The other gesture: an ordinary card becomes the box. It has to be meant,
    // so a drag that merely passes over a card leaves it alone.
    const two = await rectOf('mk-two');
    const three = await rectOf('mk-three');
    await dragHolding(centreOf(two), centreOf(three), 0);
    check('a card passed over is not turned into a box', !(await holds('mk-three', 'mk-two')));

    await reopen();
    const twoAgain = await rectOf('mk-two');
    const threeAgain = await rectOf('mk-three');
    await dragHolding(centreOf(twoAgain), centreOf(threeAgain), 1200);
    check('a card held over becomes one', await holds('mk-three', 'mk-two'));
    await reopen();
    check(
      'and the node it swallowed is drawn inside it',
      inside(await rectOf('mk-two'), await rectOf('mk-three')),
    );

    // And the gesture that needs nothing dropped on anything.
    const clickMenuItem = async (needle) => {
      const at = await page.evaluate((text) => {
        const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
          (el.textContent ?? '').includes(text),
        );
        if (item === undefined) return null;
        const rect = item.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }, needle);
      if (at === null) return false;
      await page.mouse.click(at.x, at.y);
      await wait(1200);
      return true;
    };

    /*
     * On two nodes of this section's own, apart from everything else. The
     * fixture's own nodes have by now been dragged in and out of groups by the
     * checks above and sit under whatever else was dropped on top of them, so a
     * click at the middle of one lands on something else — which tests the
     * gesture against the mess rather than against the gesture.
     */
    await reopen();
    const chosen = () =>
      page.evaluate(() => document.querySelectorAll('.react-flow__node.selected').length);

    const first = centreOf(await rectOf('mk-four'));
    await page.mouse.click(first.x, first.y);
    await wait(800);
    check('clicking a node selects it', (await chosen()) === 1, String(await chosen()));

    const second = centreOf(await rectOf('mk-five'));
    await page.keyboard.down('Control');
    await page.mouse.click(second.x, second.y);
    await page.keyboard.up('Control');
    await wait(600);
    check('two nodes can be held selected at once', (await chosen()) === 2, String(await chosen()));

    const menuAt = centreOf(await rectOf('mk-five'));
    await page.mouse.click(menuAt.x, menuAt.y, { button: 'right' });
    await wait(900);
    const onOffer = await page.evaluate(() =>
      [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent?.trim() ?? ''),
    );
    const offered = await clickMenuItem('Group 2 nodes');
    check(
      'a selection of two is offered a box round it',
      offered,
      `selected ${await chosen()}, menu: ${onOffer.join(' / ').slice(0, 100)}`,
    );

    const grouped = await call(`/plans/${fixture.id}`);
    const made = (grouped.nodes ?? []).find((node) => node.kind === 'group' && node.slug !== 'boxy');
    check(
      'and asking for one makes a group holding both',
      made !== undefined &&
        (grouped.edges ?? []).filter(
          (edge) =>
            edge.kind === 'contains' &&
            edge.from === made.slug &&
            (edge.to === 'mk-four' || edge.to === 'mk-five'),
        ).length === 2,
      made === undefined ? 'no group made' : made.slug,
    );
    check(
      'which is drawn at bounds that enclose them',
      made?.size != null && made.size.width > 0 && made.size.height > 0,
      JSON.stringify(made?.size ?? null),
    );

    // A box you can pull the corner of. Nothing but auto-layout could set these
    // bounds before.
    console.log('\na box drawn around what is in it');
    /*
     * A box used to be a stored size with handles on it, and the two answers
     * disagreed every time anything moved. It is now the bounding box of its
     * contents, so there is nothing to pull and nothing to pull against.
     */
    await reopen();
    check(
      'a box offers nothing to pull, because its size is not its own',
      (await page.$$('.react-flow__node[data-id="boxy"] .react-flow__resize-control')).length === 0,
    );

    const boxed = await rectOf('boxy');
    const heldCard = await rectOf('mk-one');
    const isHeld = await holds('boxy', 'mk-one');
    check(
      'a box holds what is in it',
      isHeld && boxed !== null && heldCard !== null && inside(heldCard, boxed),
    );

    /*
     * The half the old rule could not do. A drop was clamped wholly inside the
     * room its box had, and the box only ever grew down and to the right from
     * its own stored corner — so dragging a child up and to the left either
     * pushed it back or left it hanging outside the boundary holding it.
     */
    if (isHeld && heldCard !== null && boxed !== null) {
      const cornerWas = { x: boxed.x, y: boxed.y };
      const step = 60 * (await zoomNow());
      await dragHolding(
        { x: heldCard.x + heldCard.width / 2, y: heldCard.y + heldCard.height / 2 },
        { x: heldCard.x + heldCard.width / 2 - step, y: heldCard.y + heldCard.height / 2 - step },
        0,
      );
      const boxNow = await rectOf('boxy');
      check(
        'and reaches up and to the left after the child it holds',
        boxNow !== null && boxNow.x < cornerWas.x - 10 && boxNow.y < cornerWas.y - 10,
        `${Math.round(cornerWas.x)},${Math.round(cornerWas.y)} -> ${Math.round(boxNow?.x ?? 0)},${Math.round(boxNow?.y ?? 0)}`,
      );
      check(
        'without letting go of it',
        (await holds('boxy', 'mk-one')) && inside(await rectOf('mk-one'), await rectOf('boxy')),
      );
    }

    // Taking a node out, said plainly rather than by dragging it far enough.
    const toFree = await rectOf('mk-one');
    if (toFree !== null) {
      await page.mouse.click(toFree.x + toFree.width / 2, toFree.y + 8, { button: 'right' });
      await wait(700);
      const freed = await clickMenuItem('Take out of');
      check('a node in a box is offered a way out of it', freed);
      await wait(900);
      if (freed) {
        check('and taking it leaves the box', !(await holds('boxy', 'mk-one')));
        check(
          'and sets it down outside the boundary it has left',
          !inside(await rectOf('mk-one'), await rectOf('boxy')),
        );
      }
    }

    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          { op: 'delete_node', slug: 'boxy' },
          { op: 'delete_node', slug: 'mk-one' },
          { op: 'delete_node', slug: 'mk-two' },
          { op: 'delete_node', slug: 'mk-three' },
          { op: 'delete_node', slug: 'mk-four' },
          { op: 'delete_node', slug: 'mk-five' },
          ...(made === undefined ? [] : [{ op: 'delete_node', slug: made.slug }]),
        ],
      },
    });

    console.log('\nnotes on the drawing');
    /*
     * A note is not a node: it is not in the React Flow node layer, nothing
     * connects to it, and layout must never move it. Each of those is a way it
     * could quietly become one.
     */
    const note = await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          {
            op: 'upsert_comment',
            comment: {
              id: 'check-note',
              body: 'Left by the browser check.',
              author: 'Check',
              anchor: 'alpha',
              position: { x: 40, y: 320 },
            },
          },
        ],
      },
    });
    check('a note can be left over the write door', note?.error === undefined, String(note?.error ?? ''));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(1400);

    const left = await page.evaluate(() => {
      const found = [...document.querySelectorAll('div')].find((el) =>
        (el.textContent ?? '').includes('Left by the browser check.'),
      );
      if (found === undefined) return null;
      const rect = found.getBoundingClientRect();
      return {
        onScreen: rect.width > 0 && rect.height > 0,
        // A note drawn inside the node layer would be a node in all but name.
        insideNodeLayer: found.closest('.react-flow__node') !== null,
      };
    });
    check('it is drawn on the canvas', left?.onScreen === true, left === null ? 'not found' : '');
    check('and is not a node', left?.insideNodeLayer === false);

    const walked = await page.evaluate(() => {
      const header = document.querySelector('header');
      const button = [...(header?.querySelectorAll('button') ?? [])].find(
        (el) => (el.getAttribute('aria-label') ?? '') === 'Go to the next open note',
      );
      return button !== undefined;
    });
    check('and the row offers a way to reach it', walked === true);

    // A note was one width and four lines tall whatever was in it.
    const noteCorner = await page.evaluate(() => {
      // The note itself, not whichever wrapper above it also contains the text.
      const note = [...document.querySelectorAll('.nopan')].find((el) =>
        (el.textContent ?? '').includes('Left by the browser check.'),
      );
      if (note === undefined) return null;
      const rect = note.getBoundingClientRect();
      return { x: rect.x + rect.width - 4, y: rect.y + rect.height - 4 };
    });
    check('a note has a corner to pull', noteCorner !== null);
    if (noteCorner !== null) {
      await dragHolding(noteCorner, { x: noteCorner.x + 140, y: noteCorner.y + 90 }, 0);
      const stored = await call(`/plans/${fixture.id}`);
      const sized = (stored.comments ?? []).find((comment) => comment.id === 'check-note')?.size;
      check(
        'and pulling it stores what it was dragged to',
        sized != null && sized.width > 240 && sized.height > 100,
        JSON.stringify(sized ?? null),
      );
    }

    console.log('\nwho is here');
    // Alone, the roster still shows you: a collaborative canvas that shows
    // nobody until somebody arrives gives no way to tell "only me" from "not
    // connected".
    const roster = await page.evaluate(() => {
      const header = document.querySelector('header');
      const button = [...(header?.querySelectorAll('button') ?? [])].find((el) =>
        /here$/.test(el.getAttribute('aria-label') ?? ''),
      );
      return button === undefined ? null : button.getAttribute('aria-label');
    });
    check('the row says who is on the plan', roster !== null, roster ?? 'no roster');

    console.log('\nthe title block');
    // The row carries what is done to the drawing over and over, and nothing
    // else: choosing what a line means before drawing it asked the question at
    // the moment the person knew least about the answer, so it went away and
    // the line is named on the line instead.
    const bar = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (header === null) return null;
      const labels = [...header.querySelectorAll('button')].map(
        (button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
      );
      return {
        labels,
        actions: header.querySelector('button[aria-label="Plan actions"]') !== null,
        size: [...header.querySelectorAll('span')]
          .map((span) => span.textContent?.trim() ?? '')
          .find((text) => /^\d+ nodes?$/.test(text)) ?? '',
      };
    });
    check(
      'nothing on the row chooses what a line will mean',
      bar !== null && !bar.labels.some((label) => /Depends on|Contains|Relates to|Flows to/.test(label)),
      (bar?.labels ?? []).join(' | ').slice(0, 80),
    );
    check('the actions are behind one button at every width', bar?.actions === true);
    check('and the size of the plan reads as one line', /^\d+ nodes?$/.test(bar?.size ?? ''), bar?.size);

    console.log('\nchanging what a node is called');
    /*
     * The Add node dialog has promised from the beginning that the identifier
     * "can be changed later". Nothing delivered it — the operation vocabulary
     * had no rename in it at all — and the slug is both the address an agent
     * calls a node by and the name of the file it exports to.
     */
    const identifierBox = async (value) =>
      page.evaluate((current) => {
        const input = [...document.querySelectorAll('aside input')].find(
          (el) => el.value === current,
        );
        if (input === undefined) return null;
        const rect = input.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }, value);

    const retype = async (was, next) => {
      const at = await identifierBox(was);
      if (at === null) return false;
      await page.mouse.click(at.x, at.y);
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.type(next);
      await page.keyboard.press('Enter');
      await wait(1200);
      return true;
    };

    const touching = async (slug) => {
      const plan = await call(`/plans/${fixture.id}`);
      return {
        exists: (plan.nodes ?? []).some((node) => node.slug === slug),
        lines: (plan.edges ?? []).filter((edge) => edge.from === slug || edge.to === slug).length,
      };
    };

    await reopen();
    const looseCard = await rectOf('loose');
    await page.mouse.click(looseCard.x + looseCard.width / 2, looseCard.y + looseCard.height / 2);
    await wait(700);
    const wasTouching = await touching('loose');
    check('a node offers its identifier for editing', (await identifierBox('loose')) !== null);

    if (await retype('loose', 'free-standing')) {
      const now = await touching('free-standing');
      check('changing it gives the node the new one', now.exists);
      check('and the old one is gone', !(await touching('loose')).exists);
      check(
        'and every line that touched it comes along',
        now.lines === wasTouching.lines && wasTouching.lines > 0,
        `${wasTouching.lines} -> ${now.lines}`,
      );
      check(
        'and the panel is still about the same node',
        (await identifierBox('free-standing')) !== null,
      );

      // An identifier another node already answers to is refused, and nothing
      // is half-written when it is.
      await retype('free-standing', 'alpha');
      check(
        'an identifier already in use is refused',
        (await touching('free-standing')).exists && (await touching('alpha')).exists,
      );

      await reopen();
      const renamedCard = await rectOf('free-standing');
      check('the renamed node is still drawn', renamedCard !== null);
      if (renamedCard !== null) {
        await page.mouse.click(
          renamedCard.x + renamedCard.width / 2,
          renamedCard.y + renamedCard.height / 2,
        );
        await wait(700);
        await retype('free-standing', 'loose');
      }
      check('and it can be given its old name back', (await touching('loose')).exists);
    }

    // Editing an identifier leaves the inspector open over the canvas, and the
    // checks below ask what is drawn at a point. Put the screen back first.
    await reopen();

    console.log('\ndrawing a connection');
    const terminal = await page
      .$eval('.react-flow__node[data-id="alpha"] .react-flow__handle.source', (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
      .catch(() => null);
    const topmost =
      terminal === null
        ? ''
        : await page.evaluate(
            ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
            terminal,
          );
    check(
      "a group's terminal is not buried behind the edges",
      topmost.includes('handle'),
      topmost.slice(0, 60),
    );
    // Both of these shipped looking finished and doing nothing. A line could
    // be bent only by finding an eight-pixel dot on a line you had already
    // worked out was selectable, and a note took no pointer events at all --
    // it inherited pointer-events: none from the portal it is drawn in and
    // never said otherwise. Neither is reachable by a unit test, and both are
    // one CSS property away from being decorative again.
    console.log('\nhandling what is drawn');

    const edgeMid = async () =>
      page.evaluate(() => {
        const p = document.querySelector('.react-flow__edge-path');
        if (p === null) return null;
        const at = p.getPointAtLength(p.getTotalLength() / 2);
        const pt = p.ownerSVGElement.createSVGPoint();
        pt.x = at.x;
        pt.y = at.y;
        const screen = pt.matrixTransform(p.getScreenCTM());
        return { x: screen.x, y: screen.y };
      });

    /** The corners stored on whichever line has any. */
    const routeOn = async () => {
      const doc = await call(`/plans/${fixture.id}`);
      const bent = (doc.edges ?? []).find((edge) => (edge.waypoints?.length ?? 0) > 0);
      return bent?.waypoints ?? [];
    };

    /** Where the writing on that line sits, if it has been placed. */
    const labelOn = async () => {
      const doc = await call(`/plans/${fixture.id}`);
      const bent = (doc.edges ?? []).find((edge) => (edge.waypoints?.length ?? 0) > 0);
      return bent?.labelPosition ?? null;
    };

    // Press, drag sideways, let go. Sideways only: a vertical run moves on one
    // axis, and a Firefox pointer that leaves the window is refused outright
    // rather than clamped.
    const pushRun = async (at, by) => {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x + by, at.y, { steps: 8 });
      await page.mouse.up();
      await wait(1600);
    };

    const grab = await edgeMid();
    check('a line offers itself to the pointer', grab !== null, JSON.stringify(grab));

    if (grab !== null) {
      await pushRun(grab, 60);
      const first = await routeOn();

      check(
        'dragging a run of a line stores a route, with no selecting first',
        first.length >= 2,
        `${first.length} corners`,
      );
      check(
        'and the route is square -- the run it moved shares one x',
        first.length >= 2 && first[0].x === first[1].x,
        JSON.stringify(first.slice(0, 2)),
      );

      // The writing has to be sitting on the run for carrying it to mean
      // anything. Left where layout put it, it is on some other leg and the
      // check passes by doing nothing, which is not a check.
      const bent = ((await call(`/plans/${fixture.id}`)).edges ?? []).find(
        (edge) => (edge.waypoints?.length ?? 0) > 0,
      );
      if (bent !== undefined && first.length >= 2) {
        await call(`/plans/${fixture.id}/ops`, {
          method: 'POST',
          body: {
            ops: [
              {
                op: 'upsert_edge',
                edge: {
                  from: bent.from,
                  to: bent.to,
                  kind: bent.kind,
                  via: bent.via ?? null,
                  label: bent.label ?? null,
                  carries: bent.carries ?? null,
                  waypoints: bent.waypoints,
                  labelPosition: {
                    x: first[0].x,
                    y: Math.round((first[0].y + first[1].y) / 2),
                  },
                },
              },
            ],
          },
        });
        await wait(1600);
      }

      // An untouched line has no corner to compare against, so which way it went
      // is only provable between two drags.
      const labelBefore = await labelOn();
      const again = await edgeMid();
      if (again !== null && first.length >= 2) {
        await pushRun(again, -80);
        const second = await routeOn();

        check(
          'and the run goes the way the pointer goes',
          second.length >= 1 && second[0].x < first[0].x,
          `${first[0]?.x} -> ${second[0]?.x}`,
        );
        check(
          'without ever growing a corner',
          second.length === first.length,
          `${first.length} -> ${second.length}`,
        );

        const labelAfter = await labelOn();
        check(
          'the writing was put on the run that moves',
          labelBefore !== null && labelAfter !== null,
          JSON.stringify(labelBefore),
        );
        if (labelBefore !== null && labelAfter !== null && second.length >= 1) {
          const moved = labelAfter.x - labelBefore.x;
          const run = second[0].x - first[0].x;
          check(
            'and the writing on the run travels with it',
            moved === run && run !== 0,
            `writing ${moved}, run ${run}`,
          );
        }
      }

      // A grab that does not move is a click, and the inspector is where a line
      // is put back now that there are no dots to press Delete on.
      const settled = await edgeMid();
      if (settled !== null) {
        await page.mouse.click(settled.x, settled.y);
        await wait(900);
        const pressed = await page.evaluate(() => {
          const button = [...document.querySelectorAll('button')].find(
            (candidate) => (candidate.textContent ?? '').trim() === 'Straighten',
          );
          if (button === undefined) return false;
          button.click();
          return true;
        });
        check('taking hold of a line without moving it opens its inspector', pressed);
        await wait(1400);
        check('and Straighten puts the line back', (await routeOn()).length === 0);
      }
    }

    // A note, created the way an agent would and then handled the way a person does.
    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          {
            op: 'upsert_comment',
            comment: { id: 'gate-note', body: 'Reachable?', author: 'Check', position: { x: 120, y: 320 } },
          },
        ],
      },
    });
    await wait(1500);

    // Scoped to the note this section made, never to "the first note": the
    // fixture already carries one, so the first is somebody else's and the
    // checks silently drag and delete the wrong thing.
    const MINE = 'Reachable?';
    const noteBox = await page.evaluate((body) => {
      const el = [...document.querySelectorAll('div')].find(
        (d) => (d.className || '').toString().includes('nopan nodrag absolute') && d.textContent.includes(body),
      );
      if (el === undefined) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, pe: getComputedStyle(el).pointerEvents };
    }, MINE);
    check('a note is drawn', noteBox !== null);
    check(
      'and takes pointer events rather than being a picture of one',
      noteBox?.pe === 'auto',
      noteBox?.pe,
    );

    if (noteBox !== null) {
      await page.mouse.click(noteBox.x + noteBox.w / 2, noteBox.y + noteBox.h * 0.55);
      await wait(900);
      const editing = await page.evaluate(() => document.querySelectorAll('textarea').length);
      check('clicking it opens its editor', editing > 0, `${editing} textarea`);

      const noteAt = async () => {
        const doc = await call(`/plans/${fixture.id}`);
        return (doc.comments ?? []).find((c) => c.id === 'gate-note')?.position ?? null;
      };
      const was = await noteAt();
      await page.mouse.move(noteBox.x + noteBox.w / 2, noteBox.y + 8);
      await page.mouse.down();
      await page.mouse.move(noteBox.x + noteBox.w / 2 + 90, noteBox.y + 68, { steps: 12 });
      await page.mouse.up();
      await wait(1600);
      check('and dragging its head moves it', JSON.stringify(was) !== JSON.stringify(await noteAt()));

      // Found and clicked inside the note that owns it, in one step: committing
      // the drag re-renders, so a handle taken beforehand can point at a
      // detached button and clicking it does nothing at all.
      const clicked = await page.evaluate((body) => {
        const note = [...document.querySelectorAll('div')].find(
          (d) => (d.className || '').toString().includes('nopan nodrag absolute') && d.textContent.includes(body),
        );
        const button = note === undefined
          ? undefined
          : [...note.querySelectorAll('button')].find((b) => b.textContent.includes('Delete note'));
        if (button === undefined) return false;
        button.click();
        return true;
      }, MINE);
      check('the note offers a delete button of its own', clicked);

      if (clicked) {
        // Polled rather than waited on: the read model is a debounced
        // projection, and a fixed pause calls a slow write a failure.
        let gone = false;
        for (let i = 0; i < 12 && !gone; i += 1) {
          await wait(500);
          const doc = await call(`/plans/${fixture.id}`);
          gone = !(doc.comments ?? []).some((c) => c.id === 'gate-note');
        }
        check('and it deletes that note', gone);
      }
    }

    console.log('\na note that asks something');
    // A note used to be drawn as plain text, asterisks and all. Now it is
    // rendered, and a task list in it is how a person answers a question an
    // agent would otherwise have guessed at. None of that is visible from the
    // protocol: the document holds the same string either way.
    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          {
            op: 'upsert_comment',
            comment: {
              id: 'gate-question',
              body: '**Which store?**\n\n- [ ] Postgres\n- [ ] Redis',
              author: 'Check',
              position: { x: 320, y: 320 },
            },
          },
        ],
      },
    });
    await wait(1800);

    const drawn = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('input[type=checkbox]')];
      return {
        boxes: boxes.length,
        disabled: boxes.filter((box) => box.disabled).length,
        bold: document.querySelectorAll('strong').length,
        asterisks: (document.body.textContent ?? '').includes('**Which store?**'),
      };
    });
    check('a note draws its task list as boxes', drawn.boxes >= 2, JSON.stringify(drawn));
    check('and its Markdown as Markdown', drawn.bold > 0 && !drawn.asterisks, JSON.stringify(drawn));
    check(
      'and the boxes are live for somebody who may edit',
      drawn.boxes > 0 && drawn.disabled === 0,
      `${drawn.disabled} of ${drawn.boxes} disabled`,
    );

    const asked = async () => {
      const doc = await call(`/plans/${fixture.id}`);
      return (doc.comments ?? []).find((c) => c.id === 'gate-question')?.body ?? '';
    };
    const was = await asked();

    const boxAt = await page.evaluate(() => {
      const box = document.querySelector('input[type=checkbox]');
      if (box === null) return null;
      const r = box.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    check('a box can be reached by the pointer', boxAt !== null, JSON.stringify(boxAt));

    if (boxAt !== null) {
      await page.mouse.click(boxAt.x, boxAt.y);
      await wait(1800);
      const now = await asked();
      check('ticking one answers it', now.includes('- [x] Postgres'), now.split('\n').pop());
      check(
        'and changes exactly one character',
        now.length === was.length && [...was].filter((c, at) => c !== now[at]).length === 1,
        `${was.length} -> ${now.length}`,
      );
      // Storing what came in over the socket is debounced, so the entry is
      // not there the instant the box is ticked. Polled rather than waited on
      // by a guessed number, which is the same check either way and does not
      // break when the debounce is retuned.
      let history = [];
      for (let attempt = 0; attempt < 12; attempt += 1) {
        history = (await call(`/plans/${fixture.id}/changes?limit=10`)) ?? [];
        if (history.some((entry) => entry.kind === 'note.answered')) break;
        await wait(2000);
      }
      check(
        'and the history calls it an answer',
        history.some((entry) => entry.kind === 'note.answered'),
        history.map((entry) => entry.kind).join(', '),
      );
    }

    // The same note through a share link, which opens with no login at all.
    const { token } = await call(`/plans/${fixture.id}/share`, { method: 'POST', body: {} });
    const visitor = await browser.newPage();
    try {
      await visitor.goto(`${BASE}/share/${token}`, { waitUntil: 'domcontentloaded' });
      await wait(3000);
      const shared = await visitor.evaluate(() => {
        const boxes = [...document.querySelectorAll('input[type=checkbox]')];
        return {
          boxes: boxes.length,
          live: boxes.filter((box) => !box.disabled).length,
          anchors: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? ''),
        };
      });
      check(
        'a shared plan draws a task list that cannot be answered',
        shared.boxes > 0 && shared.live === 0,
        JSON.stringify({ boxes: shared.boxes, live: shared.live }),
      );
      check(
        'and carries no link a reader did not agree to',
        shared.anchors.every((href) => !/^\s*(javascript|data|vbscript):/i.test(href)),
        shared.anchors.join(' ').slice(0, 80),
      );
    } finally {
      await visitor.close();
      await call(`/plans/${fixture.id}/share`, { method: 'DELETE' });
    }

    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: { ops: [{ op: 'delete_comment', id: 'gate-question' }] },
    });

    console.log('\nopening a plan');
    // The document arrives over a socket after the canvas has mounted, so a
    // frame taken at init is a frame around whichever handful had landed. And
    // the drawing puts itself down rather than appearing whole — however many
    // parts arrive, they are spread across one short sweep.
    await page.goto(`${BASE}/plan/${fixture.id}`, { waitUntil: 'domcontentloaded' });
    let sweep = null;
    for (let i = 0; i < 20 && sweep === null; i += 1) {
      const seen = await page.evaluate(() =>
        [...document.querySelectorAll('.plan-arrive')].map((el) => el.style.animationDelay),
      );
      if (seen.length > 2) sweep = seen;
      await wait(120);
    }
    check(
      'the drawing puts itself down rather than appearing whole',
      sweep !== null && new Set(sweep).size > 2,
      sweep === null ? 'no arrival seen' : `${sweep.length} arriving, ${new Set(sweep).size} delays`,
    );

    await wait(3500);
    const opened = await page.evaluate(() => {
      const pane = document.querySelector('.react-flow__pane')?.getBoundingClientRect();
      const boxes = [...document.querySelectorAll('.react-flow__node')].map((el) =>
        el.getBoundingClientRect(),
      );
      if (pane === undefined) return { drawn: 0, inside: 0 };
      return {
        drawn: boxes.length,
        inside: boxes.filter(
          (r) => r.right > pane.left && r.left < pane.right && r.bottom > pane.top && r.top < pane.bottom,
        ).length,
      };
    });
    check(
      'and every part of it is on screen',
      opened.drawn > 0 && opened.inside === opened.drawn,
      `${opened.inside} of ${opened.drawn}`,
    );

    /*
     * Last of the canvas sections, deliberately. It arranges the whole plan to
     * prove a hand-set size survives one, and an arrange moves every node that
     * nobody placed — so run earlier it would hand the checks below a drawing
     * laid out differently from the one they were written against, and a line
     * they meant to bend would have become straight.
     */
    console.log('\nwriting against what you read');
    /*
     * apply_ops writes whole fields — an upsert sets title, status and kind
     * outright — so Yjs merges characters inside a body but not two setters of
     * the same field. An agent acting on a stale read really can overwrite a
     * person, and only an end-to-end check can see that the comparison happens
     * inside the document lock rather than beside it.
     */
    // Through the check's own authenticated caller rather than a fetch of its
    // own: the share section below declares a `token` of its own in this block,
    // so naming that identifier here reaches it before it exists.
    const opsWith = (payload) => call(`/plans/${fixture.id}/ops`, { method: 'POST', body: payload });

    const readRevision = async () => (await call(`/plans/${fixture.id}/revision`))?.revision ?? null;

    const revision = await readRevision();
    check('a plan says what it is at', revision !== null, String(revision).slice(0, 24));

    if (revision !== null) {
      const fresh = await opsWith({
        ops: [{ op: 'upsert_node', node: { slug: 'raced', title: 'Raced' } }],
        expectedRevision: revision,
      });
      check('a batch written against it applies', fresh?.error === undefined, String(fresh?.error));

      const stale = await opsWith({
        ops: [{ op: 'upsert_node', node: { slug: 'raced', title: 'Overwritten' } }],
        expectedRevision: revision,
      });
      check(
        'and one written against a revision that has moved on is refused',
        stale?.error === 409,
        String(stale?.error),
      );

      const after = await call(`/plans/${fixture.id}`);
      check(
        'and the refused batch changed nothing at all',
        (after.nodes ?? []).find((node) => node.slug === 'raced')?.title === 'Raced',
        (after.nodes ?? []).find((node) => node.slug === 'raced')?.title ?? 'gone',
      );

      const unchecked = await opsWith({
        ops: [{ op: 'upsert_node', node: { slug: 'raced', title: 'Unchecked' } }],
      });
      check(
        'a batch naming no revision applies, as every client today does',
        unchecked?.error === undefined,
        String(unchecked?.error),
      );

      const moved = await readRevision();
      check('and the revision has moved with the plan', moved !== revision, String(moved).slice(0, 24));
    }

    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: { ops: [{ op: 'delete_node', slug: 'raced' }] },
    });

    console.log('\na card with something to say');
    /*
     * A card used to be 260 wide whatever was in it, with two lines of its body
     * drawn and the rest readable only in the inspector — while the server was
     * already reserving room for the whole thing. The content sets the height
     * now, and nothing stores it, which is why every plan drawn before that is
     * right the moment it is opened.
     *
     * Each gesture gets a node of its own. Piling them onto one leaves the last
     * check arguing with the state the ones above it left behind.
     */
    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          { op: 'upsert_node', node: { slug: 'wordy', title: 'Wordy', body: 'a sentence long enough that it has to wrap more than once on a card of the standard width, twice over.\n'.repeat(3) } },
          { op: 'upsert_node', node: { slug: 'widthy', title: 'Widthy', body: 'a sentence long enough that it has to wrap more than once on a card of the standard width, twice over.\n'.repeat(3) } },
        ],
      },
    });
    await reopen();

    /*
     * In canvas units rather than screen pixels. A card growing makes the whole
     * drawing taller and the canvas fits the whole drawing, so a box that grew
     * and a viewport that zoomed out to frame it leave the very same number of
     * pixels on screen — measured that way, "it grew" and "nothing happened"
     * look alike.
     */
    const drawnHeight = async (slug) => {
      const height = await page
        .$eval(`.react-flow__node[data-id="${slug}"]`, (el) => el.getBoundingClientRect().height)
        .catch(() => 0);
      return height / (await zoomNow());
    };
    const drawnBody = (slug) =>
      page
        .$eval(`.react-flow__node[data-id="${slug}"]`, (el) => (el.textContent ?? '').length)
        .catch(() => 0);
    const storedSize = async (slug) => {
      const doc = await call(`/plans/${fixture.id}`);
      return (doc.nodes ?? []).find((node) => node.slug === slug)?.size ?? null;
    };

    check('a card nobody has sized carries no size', (await storedSize('wordy')) === null);
    check(
      'and is still taller than a card with nothing to say',
      (await drawnHeight('wordy')) > (await drawnHeight('loose')) + 20,
      `${Math.round(await drawnHeight('wordy'))} against ${Math.round(await drawnHeight('loose'))}`,
    );
    check(
      'and shows its body rather than two clipped lines',
      (await drawnBody('wordy')) > (await drawnBody('loose')) + 40,
      `${await drawnBody('wordy')} against ${await drawnBody('loose')} characters`,
    );

    /*
     * A wheel over a body that can scroll is the body's. React Flow zooms on
     * wheel, so a card too tall to fit could only be scrolled by catching its
     * scrollbar — and the canvas moved under you while you tried.
     */
    const scrolledBy = () =>
      page.evaluate(
        () =>
          document.querySelector('.react-flow__node[data-id="wordy"] .nodrag')?.scrollTop ?? -1,
      );
    const tall = await rectOf('wordy');
    const zoomWas = await zoomNow();
    const restedAt = await scrolledBy();
    await page.mouse.move(tall.x + tall.width / 2, tall.y + tall.height / 2);
    await page.mouse.wheel({ deltaY: 220 });
    await wait(500);
    const scrolledTo = await scrolledBy();
    check(
      'a wheel over a card that overflows scrolls it',
      restedAt >= 0 && scrolledTo > restedAt,
      `${restedAt} -> ${scrolledTo}`,
    );
    check(
      'and the canvas did not zoom while it did',
      Math.abs((await zoomNow()) - zoomWas) < 0.001,
      `${zoomWas} -> ${await zoomNow()}`,
    );

    // And gives it back at the end, so a card is not a hole in the zoom.
    await page.evaluate(() => {
      const box = document.querySelector('.react-flow__node[data-id="wordy"] .nodrag');
      if (box !== null) box.scrollTop = box.scrollHeight;
    });
    await wait(200);
    const zoomBeforeEnd = await zoomNow();
    await page.mouse.wheel({ deltaY: 220 });
    await wait(500);
    check(
      'and hands the wheel back once there is nowhere left to go',
      Math.abs((await zoomNow()) - zoomBeforeEnd) > 0.001,
      `${zoomBeforeEnd} -> ${await zoomNow()}`,
    );
    await page.mouse.move(5, 5);

    // The one gesture a card offers, on a node nothing else has touched.
    const toWiden = await rectOf('widthy');
    // A single dollar hands back one element, whose `.length` is undefined, so
    // this could only ever fail. Two dollars, and a moment for the canvas to
    // finish drawing itself after the reopen above.
    let grips = 0;
    for (let attempt = 0; attempt < 8 && grips !== 1; attempt += 1) {
      await wait(300);
      grips = (await page.$$('.react-flow__node[data-id="widthy"] .react-flow__resize-control'))
        .length;
    }
    check('the grip is there before anything is selected', grips === 1, `${grips} found`);
    await page.mouse.click(toWiden.x + toWiden.width / 2, toWiden.y + toWiden.height / 2);
    await wait(600);
    const handles = await page
      .$$eval('.react-flow__node[data-id="widthy"] .react-flow__resize-control', (list) =>
        list.map((el) => el.className),
      )
      .catch(() => []);
    check(
      'a card offers one handle, on the edge it is for',
      handles.length === 1 && handles[0].includes('right'),
      handles.join(' | ').slice(0, 70),
    );

    /*
     * Six pixels inside the right edge, which is where a hand aiming at an edge
     * actually lands. The band used to straddle the border: three pixels in was
     * the connection terminal and started a line, eight out was the canvas and
     * panned it, and both looked like the card refusing to resize.
     */
    const widthGrip = await page
      .$eval('.react-flow__node[data-id="widthy"]', (el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width - 6, y: rect.y + rect.height * 0.25 };
      })
      .catch(() => null);
    const onGrip =
      widthGrip === null
        ? 'nowhere'
        : await page.evaluate(
            (at) => String(document.elementFromPoint(at.x, at.y)?.className ?? 'nothing'),
            widthGrip,
          );
    check(
      'and the pointer lands on it six pixels inside the edge',
      onGrip.includes('react-flow__resize-control'),
      onGrip.slice(0, 60),
    );

    if (widthGrip !== null) {
      const narrowAt = await drawnHeight('widthy');
      await dragHolding(widthGrip, { x: widthGrip.x + 260, y: widthGrip.y }, 0);
      const chosen = await storedSize('widthy');
      check('pulling it stores a width', chosen !== null && chosen.width > 300, JSON.stringify(chosen));
      check(
        'and the body needs less height at that width',
        (await drawnHeight('widthy')) < narrowAt,
        `${Math.round(narrowAt)} -> ${Math.round(await drawnHeight('widthy'))}`,
      );

      await reopen();
      const kept = await storedSize('widthy');
      check('which survives a reopen', kept !== null && kept.width > 300, JSON.stringify(kept));

      await call(`/plans/${fixture.id}/layout`, { method: 'POST', body: { scope: 'unpinned' } });
      await wait(1500);
      check(
        'and an Arrange of what nobody placed leaves it alone',
        (await storedSize('widthy'))?.width === kept?.width,
        `${kept?.width} -> ${(await storedSize('widthy'))?.width}`,
      );

      await reopen();
      const toReset = await rectOf('widthy');
      await page.mouse.click(toReset.x + toReset.width / 2, toReset.y + 6, { button: 'right' });
      await wait(700);
      const reset = await clickMenuItem('Use the standard width');
      check('a card is offered the standard width back', reset);
      if (reset) check('and taking it clears the width', (await storedSize('widthy')) === null);
    }

    /*
     * And the box around a card makes room, or the drawing says a node is
     * inside a boundary it visibly overflows.
     *
     * In a box of its own, placed by hand. Dropped into one of the fixture's
     * boxes the check proves nothing: those hold several nodes and are tall
     * enough for the tallest, so a card growing under them takes up slack that
     * was already there and the box quite correctly does not move.
     */
    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          {
            op: 'upsert_node',
            node: {
              slug: 'holder',
              kind: 'group',
              title: 'Holder',
              position: { x: -1800, y: 200 },
              size: { width: 400, height: 300 },
              pinned: true,
            },
          },
          {
            op: 'upsert_node',
            node: { slug: 'wordy', position: { x: -1780, y: 240 }, pinned: true },
          },
          { op: 'upsert_edge', edge: { kind: 'contains', from: 'holder', to: 'wordy' } },
        ],
      },
    });
    await reopen();

    const boxWas = await drawnHeight('holder');
    check('a card can sit in a box', inside(await rectOf('wordy'), await rectOf('holder')));
    // 40 above for the label and 20 below, which is what ELK leaves too. The
    // 300 written on this box when it was made is not consulted by anything.
    check(
      'and the box is exactly what it holds, whatever size is written on it',
      Math.round(boxWas) === Math.round(await drawnHeight('wordy')) + 60,
      `${Math.round(boxWas)} around ${Math.round(await drawnHeight('wordy'))}`,
    );

    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: { ops: [{ op: 'upsert_node', node: { slug: 'wordy', body: 'a sentence long enough that it has to wrap more than once on a card of the standard width, twice over.\n'.repeat(12) } }] },
    });
    await reopen();
    check(
      'a card grows when more is said in it',
      (await drawnHeight('wordy')) > 300,
      `${Math.round(await drawnHeight('wordy'))} tall`,
    );
    check(
      'and the box grows when what it holds is written into',
      (await drawnHeight('holder')) > boxWas + 10,
      `${Math.round(boxWas)} -> ${Math.round(await drawnHeight('holder'))}`,
    );
    check('without the card ever leaving it', inside(await rectOf('wordy'), await rectOf('holder')));

    await call(`/plans/${fixture.id}/ops`, {
      method: 'POST',
      body: {
        ops: [
          { op: 'delete_node', slug: 'wordy' },
          { op: 'delete_node', slug: 'widthy' },
          { op: 'delete_node', slug: 'holder' },
        ],
      },
    });


    console.log('\nfollowing one thread');
    // Pointing at a node is asking what it connects to. The answer is that the
    // rest of the drawing steps back — and that nothing steps back when the
    // pointer is somewhere else.
    // The section above ends mid-drag, and a pointer left resting on a card is
    // a pointer on something — park it first or this reads its own leftovers.
    await page.mouse.move(5, 5);
    await wait(500);
    const before = await page.evaluate(
      () => document.querySelectorAll('.plan-dim').length,
    );
    const card = await page.$('.react-flow__node');
    await card?.hover();
    await wait(500);
    // Counted over nodes alone: lines and the writing on them are dimmed too,
    // so a raw count of the class is not comparable with a count of nodes.
    const during = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.react-flow__node')];
      return {
        dimmed: nodes.filter((node) => node.querySelector('.plan-dim') !== null).length,
        total: nodes.length,
      };
    });
    await page.mouse.move(5, 5);
    await wait(500);
    const after = await page.evaluate(() => document.querySelectorAll('.plan-dim').length);
    check('nothing is dimmed until the pointer is on something', before === 0, String(before));
    check(
      'pointing at a node steps the rest of the drawing back',
      during.dimmed > 0 && during.dimmed < during.total,
      `${during.dimmed} of ${during.total}`,
    );
    check('and it comes back when the pointer leaves', after === 0, String(after));

  console.log('\nsomething appearing from elsewhere');
  // A plan's contents come over a socket, but the lists around it are plain
  // reads. Coming back to the window is when a person looks, so it is when the
  // lists read themselves again — otherwise somebody else's new plan is
  // invisible until the screen is opened afresh.
  await page.goto(`${BASE}/workspace/${workspaces[0].slug}/project/${projectList[0].slug}`, {
    waitUntil: 'domcontentloaded',
  });
  await wait(2500);
  // Looked for by name rather than by counting rows: an empty project draws no
  // table at all, and a count of nothing is not zero, it is nothing.
  const madeName = `Made elsewhere ${Date.now()}`;
  const listed = () =>
    page.evaluate((name) => document.body.textContent?.includes(name) ?? false, madeName);
  const elsewhere = await call(`/projects/${projectList[0].id}/plans`, {
    method: 'POST',
    body: { title: madeName, description: '' },
  });
  await wait(1500);
  check('nothing is polled while you are looking', (await listed()) === false);

  // A real away-and-back: another tab takes the front, then this one takes it
  // again, which is what fires focus and visibilitychange for real.
  const elsewhereTab = await browser.newPage();
  await elsewhereTab.goto('about:blank');
  await wait(600);
  await page.bringToFront();
  await wait(2500);
  check('and coming back to the window finds it', await listed(), madeName);
  await elsewhereTab.close();
  await call(`/plans/${elsewhere.id}`, { method: 'DELETE' });
  await call(`/trash/plans/${elsewhere.id}`, { method: 'DELETE' });

  console.log('\naddresses that lead nowhere');
  /*
   * Three silent redirects and one lie. An unknown address, a workspace that
   * is not yours and a plan that is not yours each quietly moved you somewhere
   * else, and the canvas drew an empty plan called "Untitled plan" — a drawing
   * of something that is not there. The server has always answered 404 rather
   * than 403 for all of them, deliberately; the screens now say so too.
   */
  const notFoundAt = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await wait(3500);
    return page.evaluate(() => {
      const text = document.body.textContent ?? '';
      return { text, at: window.location.pathname };
    });
  };

  /*
   * Under a path the application owns, which is a short explicit list in the
   * Caddyfile: /login /register /recent /settings/* /admin/* /workspace/*
   * /plan/* /share/* /invite/*. Everything else — including /recent/anything,
   * because the list has /recent and not /recent/* — is the marketing site,
   * which serves its own 404 page with a 404 status and always has. Two checks
   * written against those paths were reading Next's error page and calling it
   * ours. /settings/* is the application's, and nothing under it but agents is
   * a route.
   */
  const unknown = await notFoundAt(`/settings/nowhere-${Date.now()}`);
  check(
    'an address that is not a route says so',
    unknown.text.includes('There is no page here'),
    unknown.text.replace(/\s+/g, ' ').slice(0, 70),
  );
  check('and leaves you at the address you typed', unknown.at.includes('/nowhere-'), unknown.at);

  // And the marketing site, which owns every other address, answers one too.
  const outside = await page.goto(`${BASE}/nowhere-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  check('an address outside the application is a 404 from the server', outside?.status() === 404, String(outside?.status()));

  const strange = await notFoundAt(`/workspace/not-yours-${Date.now()}`);
  check(
    'a workspace that is not yours says so',
    strange.text.includes('There is no workspace here'),
    strange.text.replace(/\s+/g, ' ').slice(0, 70),
  );
  check('and does not name it as forbidden', !/forbidden|permission|not allowed/i.test(strange.text));
  // The trail is read out of the address, which is right while every address
  // leads somewhere: this one came out as "Demo's workspace > Projects" over a
  // page saying there is nothing here.
  check(
    'and the trail does not describe an address that leads nowhere',
    await page.evaluate(() => (document.querySelector('header')?.textContent ?? '').includes('Projects') === false),
  );

  // A plan id of the right shape that this account cannot open. The canvas
  // used to sit at "connecting" over an empty document and draw it as a plan.
  const hidden = await notFoundAt('/plan/cmxxxxxxxxxxxxxxxxxxxxxxxx');
  check(
    'a plan that is not yours says so rather than drawing an empty one',
    hidden.text.includes('There is no plan here'),
    hidden.text.replace(/\s+/g, ' ').slice(0, 70),
  );
  check('and draws no canvas at all', !hidden.text.includes('Untitled plan'));

  await reopen();
  console.log('\nfolders as places');
  // A folder used to be a heading spliced into the middle of the plan table: a
  // raw `td` with none of the padding every other cell has, so its name sat
  // eleven pixels left of every plan title, and nothing to click. Neither of
  // those is visible from the protocol.
  const drawerName = `Gate ${Date.now()}`;
  const drawer = await call(`/projects/${projectList[0].id}/folders`, {
    method: 'POST',
    body: { name: drawerName },
  });
  const filedTitle = `Filed ${Date.now()}`;
  const filed = await call(`/projects/${projectList[0].id}/plans`, {
    method: 'POST',
    body: { title: filedTitle, description: '', folderId: drawer.id },
  });

  await page.goto(`${BASE}/workspace/${workspaces[0].slug}/project/${projectList[0].slug}`, {
    waitUntil: 'domcontentloaded',
  });
  await wait(2500);

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('tbody tr')].map((tr) => ({
      x: Math.round(tr.children[0]?.getBoundingClientRect().x ?? -1),
      cells: tr.children.length,
      link: tr.querySelector('a')?.getAttribute('href') ?? null,
      text: (tr.textContent ?? '').trim().slice(0, 40),
    })),
  );

  check('the project index lists rows', rows.length > 0, `${rows.length} rows`);
  check(
    'and every row starts its first cell at the same place',
    new Set(rows.map((row) => row.x)).size === 1,
    rows.map((row) => row.x).join(', '),
  );
  check(
    'and every row spans the same columns',
    new Set(rows.map((row) => row.cells)).size === 1,
    rows.map((row) => row.cells).join(', '),
  );
  check(
    'and the plans inside a folder are not also listed at the top level',
    rows.every((row) => !row.text.startsWith(filedTitle)),
    rows.map((row) => row.text).join(' | ').slice(0, 120),
  );

  const folderRow = rows.find((row) => row.text.startsWith(drawerName));
  check('a folder is one of the rows', folderRow !== undefined, JSON.stringify(folderRow));
  check(
    'and it can be opened',
    folderRow?.link?.includes(`/folder/${drawer.id}`) === true,
    folderRow?.link ?? 'no link',
  );

  if (folderRow?.link != null) {
    await page.goto(`${BASE}${folderRow.link}`, { waitUntil: 'domcontentloaded' });
    await wait(2500);

    const inside = await page.evaluate(() => ({
      heading: document.querySelector('h1')?.textContent ?? '',
      // Leaf elements only: each crumb is a wrapper span around a span or a
      // link, so taking both levels reads every name twice.
      crumbs: [...document.querySelectorAll('header a, header span')]
        .filter((el) => el.children.length === 0)
        .map((el) => (el.textContent ?? '').trim())
        .filter((text) => text !== ''),
      titles: [...document.querySelectorAll('tbody tr')].map((tr) =>
        (tr.textContent ?? '').trim().slice(0, 40),
      ),
    }));

    check('the folder screen is titled after the folder', inside.heading === drawerName, inside.heading);
    check(
      'and the trail says which folder you are in',
      inside.crumbs.some((crumb) => crumb === drawerName),
      inside.crumbs.join(' > '),
    );
    check(
      'and it holds the plan filed in it',
      inside.titles.some((title) => title.startsWith(filedTitle)),
      inside.titles.join(' | ').slice(0, 120),
    );

    // The row menu is how a plan leaves a folder without the rail's drag. It has
    // to be opened with a real pointer: the menu listens for pointerdown, and a
    // synthetic click() never reaches it.
    const menuAt = await page.evaluate(() => {
      const button = document.querySelector('tbody tr button[aria-label^="Actions for"]');
      if (button === null) return null;
      const box = button.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    check('a plan row has a menu', menuAt !== null, JSON.stringify(menuAt));
    if (menuAt !== null) {
      await page.mouse.click(menuAt.x, menuAt.y);
      await wait(900);
      const offered = await page.evaluate(() => document.body.textContent ?? '');
      check('and it offers to move the plan to a folder', offered.includes('Move to folder'));
      await page.keyboard.press('Escape');
      await wait(400);
    }
  }

  await call(`/plans/${filed.id}`, { method: 'DELETE' });
  await call(`/trash/plans/${filed.id}`, { method: 'DELETE' });
  await call(`/folders/${drawer.id}`, { method: 'DELETE' });

  console.log('\na phone');
    // Nothing on this page may push the page sideways: a canvas you have to
    // scroll the chrome of is a canvas you cannot pan.
    await page.setViewport({ width: 390, height: 844 });
    await reopen();

    const narrow = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: (() => {
        const bar = document.querySelector('header');
        return bar === null ? 0 : bar.scrollWidth - bar.clientWidth;
      })(),
      railWidth: document.querySelector('aside')?.getBoundingClientRect().width ?? 0,
      actions: document.querySelector('button[aria-label="Plan actions"]') !== null,
      canvasWidth: document.querySelector('.react-flow')?.getBoundingClientRect().width ?? 0,
      attribution: document.querySelector('.react-flow__attribution') !== null,
    }));
    check('the page does not scroll sideways', narrow.overflow <= 0, `${narrow.overflow}px over`);
    check('nor does the plan header', narrow.header <= 0, `${narrow.header}px over`);
    check('the plan rail starts folded', narrow.railWidth <= 40, `${narrow.railWidth}px`);
    check('and nothing else is signing the drawing', !narrow.attribution);
    check('and the actions are behind one button', narrow.actions);
    check(
      'which leaves the canvas nearly the whole width',
      narrow.canvasWidth >= 330,
      `${narrow.canvasWidth}px of 390`,
    );

    // Opening a node has to leave something to read: at this width a 320px
    // column beside the canvas would be the whole screen and half a canvas.
    await page.evaluate(() => {
      document
        .querySelector('.react-flow__node')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await wait(600);
    const panel = await page.evaluate(() => {
      const aside = [...document.querySelectorAll('aside')].pop();
      const rect = aside?.getBoundingClientRect();
      return rect === undefined ? null : { width: rect.width, right: rect.right };
    });
    check(
      'an open panel covers the canvas rather than squeezing it',
      panel !== null && panel.width >= 330,
      panel === null ? 'no panel' : `${Math.round(panel.width)}px`,
    );

    // A fixed-layout table divides the width it is given, so widths that add up
    // to more than a phone has leave the subject of the row a single letter.
    await page.goto(`${BASE}/recent`, { waitUntil: 'domcontentloaded' });
    await wait(3000);
    const list = await page.evaluate(() => {
      const table = document.querySelector('table');
      const cell = table?.querySelector('tbody td');
      if (table == null || cell == null) return null;
      return {
        share: cell.getBoundingClientRect().width / table.getBoundingClientRect().width,
        text: (cell.textContent ?? '').trim(),
      };
    });
    check(
      'a list gives the row its subject, not one letter and an ellipsis',
      list !== null && list.share > 0.45 && list.text.replace(/…/g, '').length > 3,
      list === null ? 'no rows' : `${Math.round(list.share * 100)}% — "${list.text.slice(0, 30)}"`,
    );

    await page.setViewport({ width: 1600, height: 1000 });
  } finally {
    // Deleting only moves it to the trash now, so the fixture would pile up
    // there run after run. Take it the rest of the way.
    await call(`/plans/${fixture.id}`, { method: 'DELETE' });
    await call(`/trash/plans/${fixture.id}`, { method: 'DELETE' });
  }

  void planHref;

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  void planId;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
