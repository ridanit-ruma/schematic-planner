import { planDocSchema, type PlanDoc } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import { exportPlan } from './bundle.js';
import { fileName } from './names.js';
import { samplePlan } from './fixtures.js';

function fileAt(doc: PlanDoc, path: string): string {
  const found = exportPlan(doc).files.find((file) => file.path === path);
  if (found === undefined) throw new Error(`${path} was not exported`);
  return found.content;
}

/**
 * A vault is its links. These hold the export to being openable in Obsidian as
 * a connected set of notes, rather than a directory of unconnected ones whose
 * relationships are only legible to a parser.
 */
describe('what an Obsidian vault needs from the export', () => {
  const associated = (): PlanDoc =>
    planDocSchema.parse({
      ...samplePlan(),
      edges: [
        ...samplePlan().edges,
        {
          id: 'relates_to:auth>canvas',
          kind: 'relates_to',
          from: 'auth',
          to: 'canvas',
          label: 'shares the session token',
        },
      ],
    });

  it('records an association, which has no structure to become anything else', () => {
    expect(fileAt(associated(), '01-Foundation/02-Auth.md')).toContain('related:\n  - canvas');
  });

  it('writes the relation into the note the other end of it', () => {
    expect(fileAt(associated(), '02-Editor/Canvas.md')).toContain('related:\n  - auth');
  });

  it('links each note to its neighbours, by path, so every link resolves', () => {
    const auth = fileAt(associated(), '01-Foundation/02-Auth.md');
    expect(auth).toContain('## Links');
    expect(auth).toContain('- Inside [[01-Foundation/README|Foundation]]');
    expect(auth).toContain('- Needs [[01-Foundation/01-Database|Database]] first');
    expect(auth).toContain(
      '- Related: [[02-Editor/Canvas|Canvas]] — shares the session token',
    );
  });

  it('names what a container holds', () => {
    const foundation = fileAt(samplePlan(), '01-Foundation/README.md');
    expect(foundation).toContain('- Holds [[01-Foundation/01-Database|Database]]');
  });

  it('says which way a flow runs, from both ends', () => {
    const flowing = planDocSchema.parse({
      ...samplePlan(),
      edges: [
        ...samplePlan().edges,
        {
          id: 'flows_to:auth>canvas',
          kind: 'flows_to',
          from: 'auth',
          to: 'canvas',
          via: 'after sign-in',
          carries: 'the session',
        },
      ],
    });
    expect(fileAt(flowing, '01-Foundation/02-Auth.md')).toContain(
      '- Flows to [[02-Editor/Canvas|Canvas]] — after sign-in: the session',
    );
    expect(fileAt(flowing, '02-Editor/Canvas.md')).toContain(
      '- Reached from [[01-Foundation/02-Auth|Auth]]',
    );
  });
});

describe('notes in the export', () => {
  const noted = (): PlanDoc =>
    planDocSchema.parse({
      ...samplePlan(),
      comments: [
        {
          id: 'two-services',
          body: 'This should be two services.',
          author: 'Ruma',
          anchor: 'auth',
          position: { x: 400, y: 0 },
        },
        {
          id: 'scope',
          body: 'Is the whole of this in scope?',
          author: 'Ruma',
          anchor: null,
          position: { x: 0, y: 400 },
        },
        {
          id: 'settled',
          body: 'Answered already.',
          anchor: 'auth',
          resolved: true,
          position: { x: 800, y: 0 },
        },
      ],
    });

  it('never becomes a file of its own', () => {
    const paths = exportPlan(noted()).files.map((file) => file.path);
    expect(paths.filter((path) => path.includes('two-services'))).toEqual([]);
  });

  it('travels with the node it is about', () => {
    const auth = fileAt(noted(), '01-Foundation/02-Auth.md');
    expect(auth).toContain('## Notes');
    expect(auth).toContain('> **Ruma**');
    expect(auth).toContain('> This should be two services.');
  });

  it('keeps a settled note, marked as settled', () => {
    expect(fileAt(noted(), '01-Foundation/02-Auth.md')).toContain('> **Someone** _(resolved)_');
  });

  it('puts a note about the plan as a whole on the cover', () => {
    expect(fileAt(noted(), 'README.md')).toContain(
      '- **Ruma** — Is the whole of this in scope?',
    );
  });

  it('draws an open note on the canvas and leaves a settled one off it', () => {
    const canvas = JSON.parse(fileAt(noted(), 'plan.canvas')) as {
      nodes: { id: string; type: string }[];
      edges: { fromNode: string; toNode: string }[];
    };
    expect(canvas.nodes.find((node) => node.id === 'note-two-services')?.type).toBe('text');
    expect(canvas.nodes.find((node) => node.id === 'note-settled')).toBeUndefined();
    expect(canvas.edges).toContainEqual(
      expect.objectContaining({ fromNode: 'note-two-services', toNode: 'auth' }),
    );
  });
});

describe('containment on the exported canvas', () => {
  it('is a group frame, because that is what a box around other boxes is', () => {
    const canvas = JSON.parse(fileAt(samplePlan(), 'plan.canvas')) as {
      nodes: { id: string; type: string; label?: string; file?: string }[];
    };
    const foundation = canvas.nodes.find((node) => node.id === 'foundation');
    expect(foundation?.type).toBe('group');
    expect(foundation?.label).toBe('Foundation');

    // What holds nothing is still a note you can open.
    expect(canvas.nodes.find((node) => node.id === 'database')?.type).toBe('file');
  });
});

describe('what a note is called', () => {
  it('is its title, so a vault keeps the names it already had', () => {
    const paths = exportPlan(samplePlan()).files.map((file) => file.path);
    expect(paths).toContain('01-Foundation/01-Database.md');
  });

  /* The blocker for a Korean vault: no ASCII slug resembles the note it
     names, so the export used to rename every file and break every link
     already written between them. */
  it('survives a title with no ASCII in it at all', () => {
    const korean = planDocSchema.parse({
      id: 'plan-ko',
      title: '지리스',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [{ slug: 'memory-architecture', title: '메모리 아키텍처' }],
      edges: [],
    });
    expect(exportPlan(korean).files.map((file) => file.path)).toContain('메모리 아키텍처.md');
  });

  it('drops what a filesystem or a wikilink cannot carry', () => {
    expect(fileName('Auth / login: "fast"?', 'auth')).toBe('Auth login fast');
    expect(fileName('C:\\Users\\*', 'weird')).toBe('C Users');
    expect(fileName('[[not a link]] #tag ^block', 'linky')).toBe('not a link tag block');
  });

  it('falls back to the slug when nothing usable is left, or Windows refuses it', () => {
    expect(fileName('...', 'dots')).toBe('dots');
    expect(fileName('   ', 'blank')).toBe('blank');
    expect(fileName('CON', 'console')).toBe('console');
  });

  it('tells two notes of the same name apart by the thing that tells them apart', () => {
    const twins = planDocSchema.parse({
      id: 'plan-twins',
      title: 'Twins',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { slug: 'api-overview', title: 'Overview' },
        { slug: 'web-overview', title: 'Overview' },
      ],
      edges: [],
    });
    const paths = exportPlan(twins).files.map((file) => file.path);
    expect(paths).toContain('Overview.md');
    expect(paths).toContain('Overview (web-overview).md');
  });
});

describe('the numeric prefix', () => {
  it('is left off where no sibling depends on another', () => {
    // `canvas` is alone inside `editor`, so there is no order to carry.
    expect(exportPlan(samplePlan()).files.map((file) => file.path)).toContain(
      '02-Editor/Canvas.md',
    );
  });

  it('is applied where there is an order to carry', () => {
    const paths = exportPlan(samplePlan()).files.map((file) => file.path);
    expect(paths).toContain('01-Foundation/01-Database.md');
    expect(paths).toContain('01-Foundation/02-Auth.md');
  });

  /* A dependency out of the folder cannot reorder what is inside it. */
  it('ignores a dependency that leaves the sibling set', () => {
    const outward = planDocSchema.parse({
      ...samplePlan(),
      edges: [
        ...samplePlan().edges.filter((edge) => edge.id !== 'depends_on:auth>database'),
        { id: 'depends_on:auth>canvas', kind: 'depends_on', from: 'auth', to: 'canvas' },
      ],
    });
    const paths = outward.nodes.length === 0 ? [] : exportPlan(outward).files.map((f) => f.path);
    expect(paths).toContain('01-Foundation/Auth.md');
    expect(paths).toContain('01-Foundation/Database.md');
  });
});

describe('the title, written once', () => {
  it('is the filename, not an H1 as well', () => {
    expect(fileAt(samplePlan(), '01-Foundation/01-Database.md')).not.toContain('# Database');
  });

  /* A container's file is a README, whose name says nothing about what it is. */
  it('except on a container, whose file is called README', () => {
    expect(fileAt(samplePlan(), '01-Foundation/README.md')).toContain('# Foundation');
  });
});

describe('frontmatter this product does not own', () => {
  const custom = (): PlanDoc =>
    planDocSchema.parse({
      ...samplePlan(),
      nodes: samplePlan().nodes.map((node) =>
        node.slug === 'auth' ? { ...node, meta: { owner: 'ruma', reviewed: '2026-09-11' } } : node,
      ),
    });

  it('is written back beside the fields that are owned', () => {
    const auth = fileAt(custom(), '01-Foundation/02-Auth.md');
    expect(auth).toContain('owner: ruma');
    expect(auth).toContain("reviewed: '2026-09-11'");
    expect(auth).toContain('status: in_progress');
  });

  /* Otherwise an import could quietly rewrite the graph by naming a key. */
  it('cannot shadow a key the export writes itself', () => {
    expect(() =>
      planDocSchema.parse({
        ...samplePlan(),
        nodes: [{ slug: 'x', title: 'X', meta: { status: 'smuggled' } }],
        edges: [],
      }),
    ).toThrow();
  });
});
