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
 * Needs puppeteer-core and a Chromium on the machine; both are optional, so the
 * script says what is missing rather than failing obscurely.
 */
const BASE = (process.env['CANVAS_CHECK_URL'] ?? 'http://127.0.0.1:8443').replace(/\/+$/, '');
const EMAIL = process.env['CANVAS_CHECK_EMAIL'] ?? 'demo@schematic.local';
const PASSWORD = process.env['CANVAS_CHECK_PASSWORD'] ?? 'schematic-demo-2026';
const CHROME = process.env['CHROME_PATH'] ?? '/usr/bin/chromium';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is not installed. pnpm --filter @schematic/web add -D puppeteer-core');
  process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail === '' ? '' : `  ${detail}`}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
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
    await wait(2200);
    planHref = await page.$eval('a[href^="/plan/"]', (a) => a.getAttribute('href')).catch(() => null);
    if (planHref !== null) break;
  }
  check('a plan is listed in a project', planHref !== null, planHref ?? '');
  if (planHref === null) throw new Error('no plan to open — seed one first');

  const planId = planHref.split('/').pop();
  await page.goto(`${BASE}${planHref}`, { waitUntil: 'domcontentloaded' });
  await wait(4000);

  const nodes = await page.$$eval('.react-flow__node', (list) => list.length);
  check('nodes render', nodes > 0, `${nodes} nodes`);

  const height = await page.$eval('.react-flow', (el) => el.getBoundingClientRect().height);
  check('the canvas has height', height > 200, `${Math.round(height)}px`);

  const containers = await page.$$eval('.react-flow__node', (list) =>
    list.filter((n) => n.getBoundingClientRect().width > 320).map((n) => n.getAttribute('data-id')),
  );
  check('at least one container is drawn at its own bounds', containers.length > 0, containers.join(', '));

  console.log('\nreading it from a distance');
  // Two earlier attempts had the card change with the zoom — text dropped at a
  // threshold, then regrown in canvas units. A card is a drawing now: the same
  // at every distance, only nearer or further away.
  const measure = () =>
    page.evaluate(() => {
      const zoom = Number(
        /scale\(([0-9.]+)\)/.exec(
          document.querySelector('.react-flow__viewport')?.style.transform ?? '',
        )?.[1] ?? '1',
      );
      const labels = [...document.querySelectorAll('.react-flow__node p, .react-flow__node span')]
        .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '')
        .map((el) => getComputedStyle(el).fontSize);
      return { zoom, count: labels.length, sizes: labels.join(',') };
    });

  const near = await measure();
  for (let i = 0; i < 4; i += 1) {
    await page.click('.react-flow__controls-zoomout');
    await wait(180);
  }
  const far = await measure();
  check('zooming out actually pulled back', far.zoom < near.zoom / 2, `${near.zoom.toFixed(2)} -> ${far.zoom.toFixed(2)}`);
  check('the same labels are drawn at both distances', far.count === near.count && far.count > 0, `${near.count} -> ${far.count}`);
  check('and drawn at the same size', far.sizes === near.sizes, far.sizes.slice(0, 40));
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
  check('the rail names the workspace it belongs to', (rail?.workspace ?? '') !== '', rail?.workspace ?? 'no rail');
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
        ],
      },
    },
  });
  check('a plan to drive', typeof fixture.id === 'string', fixture.error ?? fixture.id);
  await call(`/plans/${fixture.id}/layout`, { method: 'POST', body: { scope: 'all' } });

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
  const drag = async (from, to) => {
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
    await page.goto(`${BASE}/plan/${fixture.id}`, { waitUntil: 'domcontentloaded' });
    await wait(4000);
  };

  try {
    await reopen();
    check('the fixture draws its groups as boundaries', inside(await rectOf('a-one'), await rectOf('alpha')));
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
    check('dragging a group moves it', Math.abs(alphaIs.x - alphaWas.x) > 60, `${Math.round(alphaIs.x - alphaWas.x)}px`);
    check(
      'and carries what it holds',
      Math.abs(oneIs.x - oneWas.x - (alphaIs.x - alphaWas.x)) < 2 &&
        Math.abs(oneIs.y - oneWas.y - (alphaIs.y - alphaWas.y)) < 2,
    );

    await reopen();
    check('and the move is what everyone else sees', inside(await rectOf('a-one'), await rectOf('alpha')));

    // Out of the group, then back into it.
    const box = await rectOf('alpha');
    const one = await rectOf('a-one');
    await drag(
      { x: one.x + one.width / 2, y: one.y + one.height / 2 },
      { x: box.x + box.width + 300, y: box.y + 30 },
    );
    await reopen();
    check('dragging a node out of a group leaves it', (await countIn('alpha')) === 1, String(await countIn('alpha')));
    check('and it is drawn outside the box', !inside(await rectOf('a-one'), await rectOf('alpha')));

    const back = await rectOf('alpha');
    const away = await rectOf('a-one');
    await drag(
      { x: away.x + away.width / 2, y: away.y + away.height / 2 },
      { x: back.x + back.width / 2, y: back.y + back.height - 30 },
    );
    await reopen();
    check('dropping it back in joins it again', (await countIn('alpha')) === 2, String(await countIn('alpha')));
    check('and nothing is left straddling the edge', inside(await rectOf('a-one'), await rectOf('alpha')));

    console.log('\na group inside a group');
    const alphaBox = await rectOf('alpha');
    const betaBox = await rectOf('beta');
    await drag(
      { x: betaBox.x + betaBox.width - 30, y: betaBox.y + betaBox.height - 12 },
      { x: alphaBox.x + alphaBox.width / 2, y: alphaBox.y + alphaBox.height - 30 },
    );
    await reopen();
    check('a group can be dropped into a group', inside(await rectOf('beta'), await rectOf('alpha')));
    check('the inner group still holds its own', inside(await rectOf('b-one'), await rectOf('beta')));
    check('and the outer one counts it', (await countIn('alpha')) === 3, String(await countIn('alpha')));

    const outerWas = await rectOf('alpha');
    const innerWas = await rectOf('beta');
    const deepWas = await rectOf('b-one');
    await drag(
      { x: outerWas.x + 30, y: outerWas.y + outerWas.height - 12 },
      { x: outerWas.x + 30 - 130, y: outerWas.y + outerWas.height - 12 + 90 },
    );
    const shift = { x: (await rectOf('alpha')).x - outerWas.x, y: (await rectOf('alpha')).y - outerWas.y };
    const innerIs = await rectOf('beta');
    const deepIs = await rectOf('b-one');
    check(
      'moving the outer group carries the inner one and its contents',
      Math.abs(innerIs.x - innerWas.x - shift.x) < 2 &&
        Math.abs(deepIs.x - deepWas.x - shift.x) < 2 &&
        Math.abs(deepIs.y - deepWas.y - shift.y) < 2,
      `outer ${Math.round(shift.x)},${Math.round(shift.y)}`,
    );
  } finally {
    await call(`/plans/${fixture.id}`, { method: 'DELETE' });
  }

  await page.goto(`${BASE}${planHref}`, { waitUntil: 'domcontentloaded' });
  await wait(4000);

  console.log('\ndrawing a connection');
  await page.click('button[title^="Contains"]');
  await wait(300);
  check(
    'the connection control selects Contains',
    (await page.$eval('button[title^="Contains"]', (b) => b.getAttribute('aria-pressed'))) === 'true',
  );

  const container = containers[0];
  const at = (slug, kind) =>
    page
      .$eval(`.react-flow__node[data-id="${slug}"] .react-flow__handle.${kind}`, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
      .catch(() => null);

  const from = await at(container, 'source');
  // SVG elements carry an object for `className`, so the class list is read
  // through the attribute instead — an edge on top used to read as a pass.
  const topmost = from
    ? await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
        from,
      )
    : '';
  check(
    "a container's handle is not buried behind the edges",
    topmost.includes('handle'),
    topmost.slice(0, 60),
  );

  // Leaves the demo plan tidy rather than wherever the drags above ended.
  await page.click('button[title^="Arrange"]');
  await wait(1500);

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  void planId;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
