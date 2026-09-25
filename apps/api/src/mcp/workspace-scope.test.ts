import { describe, expect, it } from 'vitest';

import { chooseFolder, folderPaths, pathParts } from './workspace-scope.js';

const drawers = [
  { id: 'f1', name: 'Architecture' },
  { id: 'f2', name: 'Ledger' },
];

describe('choosing a folder by the name an agent gave', () => {
  it('finds it', () => {
    expect(chooseFolder(drawers, 'Ledger')).toEqual({ id: 'f2', name: 'Ledger', path: 'Ledger' });
  });

  /* An agent that got the case wrong meant the folder, not a new one. */
  it('does not care about case', () => {
    expect(chooseFolder(drawers, 'ledger')).toMatchObject({ id: 'f2', name: 'Ledger' });
  });

  it('says what is there when nothing matches', () => {
    expect(() => chooseFolder(drawers, 'Spikes')).toThrow(/Architecture, Ledger/);
  });

  it('says there are none when the project has none', () => {
    expect(() => chooseFolder([], 'Spikes')).toThrow(/no folders/i);
  });

  /* Only possible for data made before create_folder started refusing to
     duplicate a name. Guessing between them would file something out of sight. */
  it('refuses to guess between two folders of the same name', () => {
    const twins = [
      { id: 'f1', name: 'Ledger' },
      { id: 'f2', name: 'Ledger' },
    ];
    expect(() => chooseFolder(twins, 'Ledger')).toThrow(/two folders called "Ledger"/);
  });
});

describe('choosing a nested folder by its path', () => {
  /*
   * Specs
   *   Billing
   *     Drafts
   *   Auth
   *     Drafts
   * Billing
   */
  const tree = [
    { id: 'specs', name: 'Specs', parentId: null },
    { id: 'billing', name: 'Billing', parentId: 'specs' },
    { id: 'b-drafts', name: 'Drafts', parentId: 'billing' },
    { id: 'auth', name: 'Auth', parentId: 'specs' },
    { id: 'a-drafts', name: 'Drafts', parentId: 'auth' },
    { id: 'top-billing', name: 'Billing', parentId: null },
  ];

  it('reads a path from the top level down', () => {
    expect(chooseFolder(tree, 'Specs/Billing/Drafts')).toEqual({
      id: 'b-drafts',
      name: 'Drafts',
      path: 'Specs/Billing/Drafts',
    });
  });

  it('forgives case, outer slashes and spaces around them', () => {
    expect(chooseFolder(tree, ' /specs / auth/ drafts/ ').id).toBe('a-drafts');
  });

  /* A name that is a path from the top means that one, even when the same name
     is used deeper down. */
  it('takes the top-level folder when a bare name is one', () => {
    expect(chooseFolder(tree, 'Billing').id).toBe('top-billing');
  });

  /* The promise that keeps prompts written before nesting working. */
  it('finds a nested folder by a bare name only it has', () => {
    expect(chooseFolder(tree, 'Auth')).toMatchObject({ id: 'auth', path: 'Specs/Auth' });
  });

  it('finds one by the end of its path', () => {
    expect(chooseFolder(tree, 'Auth/Drafts').id).toBe('a-drafts');
  });

  it('names every candidate rather than guessing between them', () => {
    expect(() => chooseFolder(tree, 'Drafts')).toThrow(
      /Specs\/Billing\/Drafts, Specs\/Auth\/Drafts/,
    );
  });

  it('lists what is there by path when nothing matches', () => {
    expect(() => chooseFolder(tree, 'Specs/Ledger')).toThrow(/Specs\/Billing\/Drafts/);
  });

  it('refuses an empty path', () => {
    expect(() => chooseFolder(tree, ' / ')).toThrow(/name a folder/i);
  });

  it('gives every folder its path', () => {
    expect(folderPaths(tree).map((folder) => folder.path)).toEqual([
      'Specs',
      'Specs/Billing',
      'Specs/Billing/Drafts',
      'Specs/Auth',
      'Specs/Auth/Drafts',
      'Billing',
    ]);
  });

  it('splits a path into its names', () => {
    expect(pathParts('Specs / Billing//Drafts/')).toEqual(['Specs', 'Billing', 'Drafts']);
  });
});
