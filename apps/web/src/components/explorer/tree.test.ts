import { describe, expect, it } from 'vitest';

import {
  EXPLORER_WIDTH,
  canDrop,
  clampWidth,
  currentProject,
  folderAncestors,
  foldersAbove,
  moveTargets,
  planAncestors,
  readReveal,
  readWidth,
  revealedIds,
  type Nav,
} from './tree';

/*
 * Two projects. In the first, Specs holds Billing, which holds Invoices;
 * Notes sits beside Specs. A plan is filed at every level.
 */
const nav: Nav = {
  workspace: { id: 'w', slug: 'acme', name: 'Acme', role: 'OWNER' },
  projects: [
    {
      id: 'p1',
      slug: 'core',
      name: 'Core',
      folders: [
        { id: 'specs', name: 'Specs', parentId: null },
        { id: 'billing', name: 'Billing', parentId: 'specs' },
        { id: 'invoices', name: 'Invoices', parentId: 'billing' },
        { id: 'notes', name: 'Notes', parentId: null },
      ],
      plans: [
        { id: 'top', title: 'Top', updatedAt: '', folderId: null },
        { id: 'deep', title: 'Deep', updatedAt: '', folderId: 'invoices' },
      ],
    },
    { id: 'p2', slug: 'site', name: 'Site', folders: [], plans: [] },
  ],
};
const core = nav.projects[0]!;

describe('the explorer width', () => {
  it('stays between its bounds', () => {
    expect(clampWidth(10)).toBe(EXPLORER_WIDTH.min);
    expect(clampWidth(900)).toBe(EXPLORER_WIDTH.max);
    expect(clampWidth(300.4)).toBe(300);
    expect(clampWidth(Number.NaN)).toBe(EXPLORER_WIDTH.initial);
  });

  it('reads a stored width, and falls back on anything else', () => {
    expect(readWidth('320')).toBe(320);
    expect(readWidth('9999')).toBe(EXPLORER_WIDTH.max);
    expect(readWidth(null)).toBe(256);
    expect(readWidth('wide')).toBe(256);
    expect(readWidth('')).toBe(256);
  });
});

describe('what has to be open', () => {
  it('walks a folder up to the top, top first', () => {
    expect(foldersAbove(core, 'invoices')).toEqual(['specs', 'billing']);
    expect(foldersAbove(core, 'specs')).toEqual([]);
  });

  it('opens a deep plan from its project down', () => {
    expect(planAncestors(nav, 'deep')).toEqual(['p1', 'specs', 'billing', 'invoices']);
    expect(planAncestors(nav, 'top')).toEqual(['p1']);
    expect(planAncestors(nav, 'elsewhere')).toBeNull();
  });

  it('opens a folder itself as well as what is above it', () => {
    expect(folderAncestors(core, 'billing')).toEqual(['p1', 'specs', 'billing']);
  });

  it('does not hang on a loop', () => {
    const looped = {
      ...core,
      folders: [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
    };
    expect(foldersAbove(looped, 'a')).toEqual(['b']);
  });
});

describe('dropping', () => {
  const folder = (id: string, parentId: string | null) =>
    ({ kind: 'folder', id, projectId: 'p1', parentId }) as const;

  it('takes a plan anywhere but where it already is', () => {
    const plan = { kind: 'plan', id: 'top', projectId: 'p1', folderId: null } as const;
    expect(canDrop(nav, plan, { projectId: 'p1', folderId: null })).toBe(false);
    expect(canDrop(nav, plan, { projectId: 'p1', folderId: 'invoices' })).toBe(true);
    expect(canDrop(nav, plan, { projectId: 'p2', folderId: null })).toBe(true);
  });

  it('keeps a folder out of itself and everything below it', () => {
    expect(canDrop(nav, folder('specs', null), { projectId: 'p1', folderId: 'specs' })).toBe(false);
    expect(canDrop(nav, folder('specs', null), { projectId: 'p1', folderId: 'invoices' })).toBe(
      false,
    );
    expect(canDrop(nav, folder('specs', null), { projectId: 'p1', folderId: 'notes' })).toBe(true);
  });

  it('keeps a folder in its own project', () => {
    expect(canDrop(nav, folder('notes', null), { projectId: 'p2', folderId: null })).toBe(false);
  });

  it('offers a folder its project top level only when it is not there already', () => {
    expect(canDrop(nav, folder('billing', 'specs'), { projectId: 'p1', folderId: null })).toBe(
      true,
    );
    expect(canDrop(nav, folder('notes', null), { projectId: 'p1', folderId: null })).toBe(false);
  });
});

describe('the move menu', () => {
  it('lists every place a plan can go, by path', () => {
    const plan = { kind: 'plan', id: 'deep', projectId: 'p1', folderId: 'invoices' } as const;
    expect(moveTargets(nav, plan).map((target) => target.path.join('/'))).toEqual([
      'Core',
      'Core/Specs',
      'Core/Specs/Billing',
      'Core/Notes',
      'Site',
    ]);
  });

  it('leaves a folder its own subtree out', () => {
    const moving = { kind: 'folder', id: 'billing', projectId: 'p1', parentId: 'specs' } as const;
    expect(moveTargets(nav, moving).map((target) => target.path.join('/'))).toEqual([
      'Core',
      'Core/Notes',
    ]);
  });
});

describe('the current project', () => {
  it('is the open plan’s, then the last used, then the first', () => {
    expect(currentProject(nav, 'deep', 'p2')?.id).toBe('p1');
    expect(currentProject(nav, undefined, 'p2')?.id).toBe('p2');
    expect(currentProject(nav, 'elsewhere', 'gone')?.id).toBe('p1');
    expect(currentProject({ ...nav, projects: [] }, undefined, null)).toBeNull();
  });
});

describe('revealing an old address', () => {
  it('reads only what it understands from the router state', () => {
    expect(readReveal(null)).toBeNull();
    expect(readReveal({ from: '/x' })).toBeNull();
    expect(readReveal({ reveal: { workspace: 'acme', project: 'core', folder: 3 } })).toEqual({
      workspace: 'acme',
      project: 'core',
    });
  });

  it('opens a folder down to itself and aims at it', () => {
    expect(revealedIds(nav, { project: 'core', folder: 'billing' })).toEqual({
      open: ['p1', 'specs', 'billing'],
      target: 'billing',
    });
  });

  it('falls back to the project when the folder is not in it', () => {
    expect(revealedIds(nav, { project: 'core', folder: 'gone' })).toEqual({
      open: ['p1'],
      target: 'p1',
    });
    expect(revealedIds(nav, { project: 'nowhere' })).toBeNull();
  });
});
