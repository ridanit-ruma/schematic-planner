import { planDocSchema, type PlanDoc } from '@schematic/schema';
import { describe, expect, it } from 'vitest';

import { exportPlan } from './bundle.js';
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
    expect(fileAt(associated(), '01-foundation/02-auth.md')).toContain('related:\n  - canvas');
  });

  it('writes the relation into the note the other end of it', () => {
    expect(fileAt(associated(), '02-editor/01-canvas.md')).toContain('related:\n  - auth');
  });

  it('links each note to its neighbours, by path, so every link resolves', () => {
    const auth = fileAt(associated(), '01-foundation/02-auth.md');
    expect(auth).toContain('## Links');
    expect(auth).toContain('- Inside [[01-foundation/README|Foundation]]');
    expect(auth).toContain('- Needs [[01-foundation/01-database|Database]] first');
    expect(auth).toContain(
      '- Related: [[02-editor/01-canvas|Canvas]] — shares the session token',
    );
  });

  it('names what a container holds', () => {
    const foundation = fileAt(samplePlan(), '01-foundation/README.md');
    expect(foundation).toContain('- Holds [[01-foundation/01-database|Database]]');
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
    expect(fileAt(flowing, '01-foundation/02-auth.md')).toContain(
      '- Flows to [[02-editor/01-canvas|Canvas]] — after sign-in: the session',
    );
    expect(fileAt(flowing, '02-editor/01-canvas.md')).toContain(
      '- Reached from [[01-foundation/02-auth|Auth]]',
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
    const auth = fileAt(noted(), '01-foundation/02-auth.md');
    expect(auth).toContain('## Notes');
    expect(auth).toContain('> **Ruma**');
    expect(auth).toContain('> This should be two services.');
  });

  it('keeps a settled note, marked as settled', () => {
    expect(fileAt(noted(), '01-foundation/02-auth.md')).toContain('> **Someone** _(resolved)_');
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
