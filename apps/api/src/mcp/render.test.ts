import { describe, expect, it } from 'vitest';
import { planDocSchema } from '@schematic/schema';

import {
  matchingLine,
  progressLine,
  renderFound,
  renderHistory,
  renderNext,
  renderNodes,
  renderPlan,
} from './render.js';

const doc = planDocSchema.parse({
  id: 'p1',
  title: 'Plan',
  description: 'Notes.',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    { slug: 'group', title: 'Group', kind: 'group', position: { x: 5, y: 5 }, pinned: true },
    { slug: 'db', title: 'Database', status: 'done' },
    { slug: 'auth', title: 'Auth' },
  ],
  edges: [
    { id: 'c1', kind: 'contains', from: 'group', to: 'db' },
    { id: 'c2', kind: 'contains', from: 'group', to: 'auth' },
    { id: 'd1', kind: 'depends_on', from: 'auth', to: 'db' },
  ],
});

describe('renderPlan', () => {
  it('outlines the hierarchy', () => {
    const outline = renderPlan(doc, 'outline');
    expect(outline).toContain('- group [group/idea] Group');
    expect(outline).toContain('  - auth [task/idea] Auth');
  });

  /*
   * The flows are the drawing. Without them this listed a nesting, which is a
   * table of contents wearing a diagram's clothes — an agent reading back a
   * plan it had drawn could not see one thing it had said about how the system
   * works.
   */
  it('writes the flows out of each node into the outline', () => {
    const wired = planDocSchema.parse({
      id: 'p3',
      title: 'Wired',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'form', title: 'Form' },
        { slug: 'api', title: 'API' },
      ],
      edges: [
        {
          id: 'f1',
          kind: 'flows_to',
          from: 'form',
          to: 'api',
          via: 'click Sign in',
          carries: '{ email }',
        },
      ],
    });

    expect(renderPlan(wired, 'outline')).toContain('--> api (click Sign in: { email })');
  });

  it('keeps a depends_on in the outline, in the direction it is recorded', () => {
    expect(renderPlan(doc, 'outline')).toContain('--depends_on--> db');
  });

  it('marks which nodes have something written on them', () => {
    const written = planDocSchema.parse({
      id: 'p4',
      title: 'Written',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'said', title: 'Said', body: 'the whole point' },
        { slug: 'bare', title: 'Bare' },
      ],
    });

    const outline = renderPlan(written, 'outline');
    expect(outline).toContain('Said *');
    expect(outline).toContain('Bare');
    expect(outline).not.toContain('Bare *');
    expect(outline).not.toContain('the whole point');
    expect(renderPlan(written, 'detail')).toContain('| the whole point');
  });

  it('never leaks coordinates into any view', () => {
    for (const view of ['outline', 'detail', 'graph', 'markdown'] as const) {
      const rendered = renderPlan(doc, view);
      expect(rendered).not.toContain('"x"');
      expect(rendered).not.toContain('position');
      expect(rendered).not.toContain('pinned');
    }
  });

  it('emits parseable json for the graph view', () => {
    const parsed = JSON.parse(renderPlan(doc, 'graph')) as { nodes: unknown[]; edges: unknown[] };
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(3);
  });

  it('renders an empty plan without crashing', () => {
    const empty = planDocSchema.parse({
      id: 'p2',
      title: 'Empty',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(renderPlan(empty, 'outline')).toContain('_empty plan_');
  });
});

import { renderPlanList } from './render.js';

const url = (id: string) => `https://example.test/plan/${id}`;

describe('renderPlanList', () => {
  const listing = [
    {
      workspace: 'demo',
      project: 'billing',
      folders: [
        { id: 'f1', name: 'Architecture' },
        { id: 'f2', name: 'Spikes' },
      ],
      plans: [
        { id: 'p1', title: 'Billing rework', nodeCount: 8, folderId: null },
        { id: 'p2', title: 'Invoice rendering', nodeCount: 12, folderId: 'f1' },
      ],
    },
  ];

  it('files each plan under the folder it is in', () => {
    const lines = renderPlanList(listing, url).split('\n');
    const folder = lines.findIndex((line) => line.trim() === 'Architecture');
    const filed = lines.findIndex((line) => line.includes('Invoice rendering'));
    expect(folder).toBeGreaterThan(-1);
    expect(filed).toBeGreaterThan(folder);
    expect(lines[filed]?.startsWith('    ')).toBe(true);
  });

  it('leaves a plan in no folder at the project level', () => {
    const line = renderPlanList(listing, url)
      .split('\n')
      .find((candidate) => candidate.includes('Billing rework'));
    expect(line?.startsWith('  ')).toBe(true);
    expect(line?.startsWith('    ')).toBe(false);
  });

  /* An empty folder is a place somebody made; an agent that cannot see it will
     make a second one with the same name. */
  it('shows a folder with nothing in it', () => {
    expect(renderPlanList(listing, url)).toContain('Spikes');
  });

  it('gives every plan its id and its address', () => {
    const out = renderPlanList(listing, url);
    expect(out).toContain('id p2');
    expect(out).toContain('https://example.test/plan/p2');
  });

  it('says so when there is nothing at all', () => {
    expect(renderPlanList([], url)).toMatch(/no plans/i);
  });
});

describe('renderNodes', () => {
  const written = planDocSchema.parse({
    id: 'p5',
    title: 'Written',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'form', title: 'Form', body: 'Two fields and a button.', tags: ['ui'] },
      { slug: 'api', title: 'API' },
    ],
    edges: [
      { id: 'f1', kind: 'flows_to', from: 'form', to: 'api', via: 'click Sign in' },
    ],
  });

  it('gives back what a node actually says', () => {
    const rendered = renderNodes(written, ['form']);
    expect(rendered).toContain('## Form (form)');
    expect(rendered).toContain('Two fields and a button.');
    expect(rendered).toContain('tags: ui');
  });

  it('says what the node is wired to, in both directions', () => {
    expect(renderNodes(written, ['form'])).toContain('flows_to --> api (click Sign in)');
    expect(renderNodes(written, ['api'])).toContain('flows_to <-- form (click Sign in)');
  });

  it('says so rather than inventing a node that is not there', () => {
    const rendered = renderNodes(written, ['form', 'ghost']);
    expect(rendered).toContain('## Form (form)');
    expect(rendered).toContain('ghost');
  });

  it('is plain about a node nobody has written on', () => {
    expect(renderNodes(written, ['api'])).toContain('nothing written here yet');
  });
});

describe('renderHistory', () => {
  const at = new Date('2026-01-02T03:04:05.000Z');

  it('says who did what, and when', () => {
    const rendered = renderHistory([
      {
        kind: 'node.body',
        subject: 'form',
        label: 'Form',
        detail: 'rewrote it',
        at,
        batchId: null,
        by: { name: 'Ruma', agent: null },
      },
    ]);

    expect(rendered).toContain('Ruma');
    expect(rendered).toContain('node.body');
    expect(rendered).toContain('form');
  });

  it('names the agent rather than the account it signed in as', () => {
    const rendered = renderHistory([
      {
        kind: 'node.added',
        subject: 'api',
        label: 'API',
        detail: null,
        at,
        batchId: 'b1',
        by: { name: 'Ruma', agent: 'claude' },
      },
    ]);

    expect(rendered).toContain('claude');
  });

  it('is plain about a plan nothing has happened to', () => {
    expect(renderHistory([])).toContain('Nothing has changed');
  });
});

describe('the order the outline is read in', () => {
  /*
   * The graph sorts siblings by slug, which the export needs and a reader does
   * not: a chain of steps came back alphabetically scrambled, and the one thing
   * the reader wanted to know was which came first.
   */
  const chain = planDocSchema.parse({
    id: 'p6',
    title: 'Chain',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'zebra', title: 'First' },
      { slug: 'alpha', title: 'Second' },
      { slug: 'middle', title: 'Third' },
    ],
    edges: [
      { id: 'f1', kind: 'flows_to', from: 'zebra', to: 'alpha' },
      { id: 'f2', kind: 'flows_to', from: 'alpha', to: 'middle' },
    ],
  });

  const order = (rendered: string) =>
    rendered
      .split('\n')
      .filter((line) => line.trimStart().startsWith('- '))
      .map((line) => line.trim().split(' ')[1]);

  it('follows the flows rather than the alphabet', () => {
    expect(order(renderPlan(chain, 'outline'))).toEqual(['zebra', 'alpha', 'middle']);
  });

  it('reads a depends_on as saying which one comes first', () => {
    const needed = planDocSchema.parse({
      id: 'p7',
      title: 'Needed',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'alpha', title: 'Needs the other' },
        { slug: 'zebra', title: 'Comes first' },
      ],
      edges: [{ id: 'd1', kind: 'depends_on', from: 'alpha', to: 'zebra' }],
    });

    expect(order(renderPlan(needed, 'outline'))).toEqual(['zebra', 'alpha']);
  });

  it('still lists everything when the flows go round in a circle', () => {
    const loop = planDocSchema.parse({
      id: 'p8',
      title: 'Loop',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'one', title: 'One' },
        { slug: 'two', title: 'Two' },
      ],
      edges: [
        { id: 'f1', kind: 'flows_to', from: 'one', to: 'two' },
        { id: 'f2', kind: 'flows_to', from: 'two', to: 'one' },
      ],
    });

    expect(order(renderPlan(loop, 'outline')).sort()).toEqual(['one', 'two']);
  });
});

describe('a note asking a question', () => {
  const asked = planDocSchema.parse({
    id: 'p9',
    title: 'Asked',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [{ slug: 'store', title: 'Store' }],
    comments: [
      {
        id: 'which-store',
        author: 'agent',
        anchor: 'store',
        body: `Which one, and why?\n\nThis is a long enough preamble that flattening the note onto a single line and cutting it at two hundred and forty characters would reach the end of it before ever reaching the answers underneath, which is exactly what used to happen.\n\n- [ ] Postgres\n- [x] Redis`,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });

  it('keeps the answers, which are the point of asking', () => {
    const outline = renderPlan(asked, 'outline');
    expect(outline).toContain('- [ ] Postgres');
    expect(outline).toContain('- [x] Redis');
  });
});

describe('renderFound', () => {
  const url = (id: string) => `https://example.test/plan/${id}`;
  const hit = {
    planId: 'p1',
    planTitle: 'Sign in',
    workspace: 'acme',
    project: 'web',
    folder: 'specs',
    slug: 'login-page',
    kind: 'feature',
    status: 'planned',
    title: 'Login page',
    where: 'title',
    line: 'Login page',
  };

  it('groups hits under the drawing they are in, with a link to it', () => {
    const rendered = renderFound([hit, { ...hit, slug: 'login-form', title: 'Login form' }], 'login', url, 3);
    expect(rendered).toContain('Sign in — acme / web / specs');
    expect(rendered).toContain('https://example.test/plan/p1');
    expect(rendered.match(/https:\/\/example.test/g)).toHaveLength(1);
    expect(rendered).toContain('login-form');
  });

  it('says how far it looked when it found nothing', () => {
    const rendered = renderFound([], 'login', url, 12);
    expect(rendered).toContain('12 plans');
    expect(rendered).toContain('"login"');
  });
});

describe('matchingLine', () => {
  const body = 'A first line.\n\nThe session cookie is set here, on the way back.\nAnd a third.';

  it('finds the line every word is on', () => {
    expect(matchingLine(body, ['session', 'cookie'])).toBe(
      'The session cookie is set here, on the way back.',
    );
  });

  it('wants every word on one line, not one word each', () => {
    expect(matchingLine(body, ['session', 'third'])).toBeNull();
  });

  it('has nothing to quote when nothing matches', () => {
    expect(matchingLine(body, ['postgres'])).toBeNull();
  });

  it('trims a line too long to quote', () => {
    const long = `x${'y'.repeat(400)} session`;
    expect(matchingLine(long, ['session'])?.length).toBeLessThan(200);
  });
});

describe('where a plan has got to', () => {
  const chain = (statuses: Record<string, string>) =>
    planDocSchema.parse({
      id: 'p10',
      title: 'Chain',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'first', kind: 'task', title: 'First', body: 'Do this one first.', status: statuses['first'] ?? 'planned' },
        { slug: 'second', kind: 'task', title: 'Second', body: 'Then this.', status: statuses['second'] ?? 'planned' },
        { slug: 'aside', kind: 'note', title: 'A remark', status: 'idea' },
        { slug: 'box', kind: 'group', title: 'A box', status: 'idea' },
      ],
      edges: [{ id: 'f1', kind: 'flows_to', from: 'first', to: 'second' }],
    });

  it('counts only the nodes somebody works on', () => {
    // The note and the box are neither done nor to do.
    expect(progressLine(chain({}))).toBe('0 of 2 done');
    expect(progressLine(chain({ first: 'done' }))).toBe('1 of 2 done');
  });

  it('says what is in progress and what is blocked', () => {
    expect(progressLine(chain({ first: 'in_progress' }))).toContain('1 in progress');
    expect(progressLine(chain({ first: 'blocked' }))).toContain('1 blocked');
  });

  it('offers the first of a chain and not the one waiting on it', () => {
    const said = renderNext(chain({}), 3);
    expect(said).toContain('Ready now');
    expect(said).toContain('first');
    expect(said).toContain('Do this one first.');
    expect(said).toContain('Waiting on unfinished work');
    expect(said).toContain('second — needs first');
  });

  it('offers the second once the first is done', () => {
    const said = renderNext(chain({ first: 'done' }), 3);
    expect(said).toContain('Then this.');
    expect(said).not.toContain('Waiting on unfinished work');
  });

  it('says what has been started, with its body', () => {
    const said = renderNext(chain({ first: 'in_progress' }), 3);
    expect(said).toContain('Already started');
    expect(said).toContain('Do this one first.');
  });

  it('says so when there is nothing left', () => {
    expect(renderNext(chain({ first: 'done', second: 'dropped' }), 3)).toContain('Nothing is left');
  });

  it('brings the note a blocked task is waiting on', () => {
    const blocked = planDocSchema.parse({
      id: 'p11',
      title: 'Stuck',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'one', kind: 'task', title: 'One', status: 'blocked' }],
      comments: [
        {
          id: 'blocked-one',
          author: 'agent',
          anchor: 'one',
          body: 'The migration needs somebody to say yes.',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const said = renderNext(blocked, 3);
    expect(said).toContain('Blocked, and waiting on a person');
    expect(said).toContain('The migration needs somebody to say yes.');
    expect(said).toContain('Nothing is ready');
  });

  it('prints the bodies of the first few and names the rest', () => {
    const many = planDocSchema.parse({
      id: 'p12',
      title: 'Many',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: Array.from({ length: 5 }, (_, at) => ({
        slug: `task-${at}`,
        kind: 'task',
        title: `Task ${at}`,
        body: `The body of ${at}.`,
        status: 'planned',
      })),
    });

    const said = renderNext(many, 2);
    expect(said).toContain('The body of 0.');
    expect(said).toContain('The body of 1.');
    expect(said).not.toContain('The body of 4.');
    expect(said).toContain('task-4');
  });

  it('is plain about a plan with nothing to work on', () => {
    const drawing = planDocSchema.parse({
      id: 'p13',
      title: 'Drawing',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'box', kind: 'group', title: 'A box' }],
    });
    expect(renderNext(drawing, 3)).toContain('nothing to work on');
  });
});

describe('a read that always ends with something to do', () => {
  const held = planDocSchema.parse({
    id: 'p14',
    title: 'Held',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { slug: 'running', kind: 'task', title: 'Running', status: 'in_progress' },
      { slug: 'after', kind: 'task', title: 'After', status: 'planned' },
    ],
    edges: [{ id: 'f1', kind: 'flows_to', from: 'running', to: 'after' }],
  });

  /*
   * The one shape that used to answer with nothing: something started, nothing
   * ready, so neither branch said a word and the reader was back to working it
   * out — which is the whole thing this replaces.
   */
  it('says to finish what is started when nothing else is ready', () => {
    const said = renderNext(held, 3);
    expect(said).toContain('Already started');
    expect(said).toContain('Nothing else is ready');
  });
});
