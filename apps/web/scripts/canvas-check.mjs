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
    // The app mints an access token before it can list anything, so waiting a
    // fixed moment here reports an empty project whenever the machine is busy.
    await page.waitForSelector('a[href^="/plan/"]', { timeout: 8000 }).catch(() => null);
    planHref = await page.$eval('a[href^="/plan/"]', (a) => a.getAttribute('href')).catch(() => null);
    if (planHref !== null) break;
  }
  check(
    'a plan is listed in a project',
    planHref !== null,
    planHref ?? (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 200),
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

  // Moving in rather than out: a plan fitted near the minimum zoom has nowhere
  // further to pull back to, and the check would be measuring the floor.
  const far = await measure();
  for (let i = 0; i < 4; i += 1) {
    await page.click('.react-flow__controls-zoomin');
    await wait(180);
  }
  const near = await measure();
  check(
    'moving in actually moved in',
    near.zoom > far.zoom * 1.8,
    `${far.zoom.toFixed(2)} -> ${near.zoom.toFixed(2)}`,
  );
  check(
    'the same labels are drawn at both distances',
    far.count === near.count && far.count > 0,
    `${far.count} -> ${near.count}`,
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
          { kind: 'flows_to', from: 'loose', to: 'b-one', via: 'click Save', carries: '{ id }' },
          { kind: 'flows_to', from: 'loose', to: 'a-one', via: 'click Delete', carries: '{ id }' },
          { kind: 'flows_to', from: 'loose', to: 'a-two', via: 'on load', carries: 'the current filter' },
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
      // It has to have moved at all: with a shift of nothing every difference
      // below is zero and the check passes without testing anything.
      Math.abs(oneIs.x - oneWas.x) > 40 &&
        Math.abs(oneIs.x - oneWas.x - (alphaIs.x - alphaWas.x)) < 2 &&
        Math.abs(oneIs.y - oneWas.y - (alphaIs.y - alphaWas.y)) < 2,
      `child ${Math.round(oneIs.x - oneWas.x)},${Math.round(oneIs.y - oneWas.y)}`,
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
    // By its own label band. The bottom of the box now holds the group that was
    // dropped into it, and grabbing there picks that up instead.
    await drag(
      { x: outerWas.x + 30, y: outerWas.y + 10 },
      { x: outerWas.x + 30 - 130, y: outerWas.y + 10 + 90 },
    );
    const shift = { x: (await rectOf('alpha')).x - outerWas.x, y: (await rectOf('alpha')).y - outerWas.y };
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

    console.log('\ndrawing a connection');
    // The control is a toggle group now. It marks the chosen one itself rather
    // than through Radix's data-state, which a tooltip wrapping it overwrites.
    await page.click('button[aria-label="Contains"]');
    await wait(300);
    check(
      'the connection control selects Contains',
      (await page.$eval('button[aria-label="Contains"]', (b) =>
        b.getAttribute('data-selected'),
      )) === 'true',
    );

    // SVG elements carry an object for `className`, so the class list is read
    // through the attribute instead — an edge on top used to read as a pass.
    // The hint moved off the native title attribute, which does not exist on a
    // touch screen and cannot be styled. It has to actually appear.
    await page.hover('button[aria-label="Depends on"]');
    await wait(1200);
    const hint = await page.evaluate(
      () => document.querySelector('[role="tooltip"]')?.textContent ?? '',
    );
    check('a hint appears on the connection control', hint.includes('Depends on'), hint.slice(0, 60));

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

  } finally {
    await call(`/plans/${fixture.id}`, { method: 'DELETE' });
  }

  void planHref;

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  void planId;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
