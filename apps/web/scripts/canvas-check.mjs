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

  const group = containers[0];
  const held = await page.$$eval('.react-flow__node', (list) => list.map((n) => n.getAttribute('data-id')));
  const box0 = await rectOf(group);
  let child = null;
  for (const slug of held) {
    if (slug === group) continue;
    if (inside(await rectOf(slug), box0)) {
      child = slug;
      break;
    }
  }
  check('the group holds something to move', child !== null, `${group} holds ${child}`);
  if (child === null) throw new Error('no node inside a group to drag with it');

  const childBefore = await rectOf(child);
  // Only the label row of a group takes events; its body is click-through so
  // that the nodes inside stay reachable.
  await drag({ x: box0.x + box0.width / 2, y: box0.y + 12 }, { x: box0.x + box0.width / 2 + 140, y: box0.y + 12 + 130 });
  const box1 = await rectOf(group);
  const childAfter = await rectOf(child);
  const groupMoved = Math.round(box1.x - box0.x);
  check('dragging a group moves it', Math.abs(groupMoved) > 60, `${groupMoved}px`);
  check(
    'and carries what it holds',
    Math.abs(childAfter.x - childBefore.x - (box1.x - box0.x)) < 2 &&
      Math.abs(childAfter.y - childBefore.y - (box1.y - box0.y)) < 2,
    `child moved ${Math.round(childAfter.x - childBefore.x)},${Math.round(childAfter.y - childBefore.y)}`,
  );

  // The move has to survive the document, not just the screen.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(4000);
  check('and the move is what everyone else sees', inside(await rectOf(child), await rectOf(group)));

  // A node that is in no group at all. Picking one already inside this group
  // would drag it around within its own box and prove nothing.
  let loose = null;
  for (const slug of held) {
    if (containers.includes(slug)) continue;
    const rect = await rectOf(slug);
    let free = true;
    for (const holder of containers) if (inside(rect, await rectOf(holder))) free = false;
    if (free) {
      loose = slug;
      break;
    }
  }
  check('there is a node outside every group', loose !== null, loose ?? '');
  const before = await countIn(group);
  const box2 = await rectOf(group);
  const looseRect = await rectOf(loose);
  if (looseRect !== null && box2 !== null) {
    await drag(
      { x: looseRect.x + looseRect.width / 2, y: looseRect.y + looseRect.height / 2 },
      { x: box2.x + box2.width / 2, y: box2.y + box2.height - 24 },
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(4000);
    check('dropping a node in a group joins it', (await countIn(group)) === before + 1, `${before} -> ${await countIn(group)}`);
    check('and nothing is left straddling the edge', inside(await rectOf(loose), await rectOf(group)));
  }

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
  const topmost = from
    ? await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className ?? '', from)
    : '';
  check(
    "a container's handle is not buried behind the edges",
    String(topmost).includes('handle'),
    String(topmost).slice(0, 60),
  );

  console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  void planId;
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
