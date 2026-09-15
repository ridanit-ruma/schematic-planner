import { describe, expect, it } from 'vitest';

import { normalizeSources, rejectSources, resolveSources, type SourceRow } from './provenance.js';

const row = (over: Partial<SourceRow> & { id: string }): SourceRow => ({
  title: 'A spec',
  projectId: 'proj',
  deletedAt: null,
  folder: { name: 'specs' },
  ...over,
});

describe('the set as it is stored', () => {
  it('keeps the order it was given', () => {
    expect(normalizeSources(['b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('carries each source once', () => {
    expect(normalizeSources(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('what a stored id resolves to now', () => {
  it('names the source and the drawer it is filed in', () => {
    expect(resolveSources(['s1'], 'proj', [row({ id: 's1' })])).toEqual([
      { id: 's1', title: 'A spec', folder: 'specs', state: 'ok' },
    ]);
  });

  it('reports a source in the trash as missing, and keeps the id', () => {
    const [source] = resolveSources(['s1'], 'proj', [row({ id: 's1', deletedAt: new Date() })]);
    expect(source).toMatchObject({ id: 's1', state: 'missing' });
  });

  it('reports a source that is simply gone as missing', () => {
    expect(resolveSources(['s1'], 'proj', [])).toEqual([
      { id: 's1', title: null, folder: null, state: 'missing' },
    ]);
  });

  it('reports a source that left the project as moved', () => {
    const [source] = resolveSources(['s1'], 'proj', [row({ id: 's1', projectId: 'elsewhere' })]);
    expect(source).toMatchObject({ id: 's1', state: 'moved' });
  });

  it('answers in the order the ids were stored', () => {
    const resolved = resolveSources(['b', 'a'], 'proj', [row({ id: 'a' }), row({ id: 'b' })]);
    expect(resolved.map((source) => source.id)).toEqual(['b', 'a']);
  });

  it('says nothing about which drawer is the right one', () => {
    const [source] = resolveSources(['s1'], 'proj', [row({ id: 's1', folder: { name: 'notes' } })]);
    expect(source).toMatchObject({ folder: 'notes', state: 'ok' });
  });
});

describe('what may be stored', () => {
  it('accepts a plan in the same project', () => {
    expect(rejectSources(['s1'], 'me', 'proj', [row({ id: 's1' })])).toBeNull();
  });

  it('accepts one filed anywhere, because the folder is a convention', () => {
    expect(rejectSources(['s1'], 'me', 'proj', [row({ id: 's1', folder: null })])).toBeNull();
  });

  it('refuses a plan in another project', () => {
    expect(rejectSources(['s1'], 'me', 'proj', [row({ id: 's1', projectId: 'other' })])).toMatch(
      /another project/,
    );
  });

  it('refuses one that is not there', () => {
    expect(rejectSources(['gone'], 'me', 'proj', [])).toMatch(/cannot reach|reach/);
  });

  it('refuses a plan citing itself', () => {
    expect(rejectSources(['me'], 'me', 'proj', [row({ id: 'me' })])).toMatch(/itself/);
  });

  it('names every problem rather than the first', () => {
    const why = rejectSources(['a', 'b'], 'me', 'proj', []);
    expect(why).toMatch(/"a"/);
    expect(why).toMatch(/"b"/);
  });
});
