import { describe, expect, it } from 'vitest';

import { chooseFolder } from './workspace-scope.js';

const drawers = [
  { id: 'f1', name: 'Architecture' },
  { id: 'f2', name: 'Ledger' },
];

describe('choosing a folder by the name an agent gave', () => {
  it('finds it', () => {
    expect(chooseFolder(drawers, 'Ledger')).toEqual({ id: 'f2', name: 'Ledger' });
  });

  /* An agent that got the case wrong meant the folder, not a new one. */
  it('does not care about case', () => {
    expect(chooseFolder(drawers, 'ledger')).toEqual({ id: 'f2', name: 'Ledger' });
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
