import { describe, expect, it } from 'vitest';

import { makeDoc } from './fixtures.js';
import { DEFAULT_VOCABULARY, validatePlan } from './index.js';

const rules = (...args: Parameters<typeof makeDoc>) =>
  validatePlan(makeDoc(...args), DEFAULT_VOCABULARY).diagnostics.map((one) => [
    one.rule,
    one.nodes.join(','),
  ]);

describe('validate', () => {
  it('says a clean plan is clean, and how much it looked at', () => {
    const result = validatePlan(
      makeDoc([{ slug: 'a' }, { slug: 'b' }], [{ kind: 'flows_to', from: 'a', to: 'b' }]),
      DEFAULT_VOCABULARY,
    );
    expect(result).toEqual({ ok: true, checked: 3, diagnostics: [] });
  });

  it('names the members of a dependency cycle as an error', () => {
    const result = validatePlan(
      makeDoc(
        [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
        [
          { kind: 'depends_on', from: 'a', to: 'b' },
          { kind: 'depends_on', from: 'b', to: 'a' },
          { kind: 'depends_on', from: 'c', to: 'a' },
        ],
      ),
      DEFAULT_VOCABULARY,
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      { severity: 'error', rule: 'dependency-cycle', nodes: ['a', 'b'], params: {} },
    ]);
  });

  it('warns about a node nothing connects to, unless it is the only one', () => {
    expect(rules([{ slug: 'alone' }])).toEqual([]);
    expect(
      rules(
        [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }],
        [{ kind: 'relates_to', from: 'a', to: 'b' }],
      ),
    ).toEqual([['isolated-node', 'c']]);
  });

  it('leaves an empty group alone: it is a box waiting to be filled', () => {
    expect(rules([{ slug: 'a' }, { slug: 'box', kind: 'group' }])).toEqual([
      ['isolated-node', 'a'],
    ]);
  });

  it('notes work left out of the flows when the plan has flows', () => {
    expect(
      rules(
        [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'why', kind: 'note' }],
        [
          { kind: 'flows_to', from: 'a', to: 'b' },
          { kind: 'depends_on', from: 'c', to: 'a' },
          { kind: 'relates_to', from: 'why', to: 'a' },
        ],
      ),
    ).toEqual([['outside-flow', 'c']]);
  });

  it('warns about kinds and statuses the project does not define', () => {
    const result = validatePlan(
      makeDoc([{ slug: 'a', kind: 'epic', status: 'reviewing' }]),
      DEFAULT_VOCABULARY,
    );
    expect(result.diagnostics.map((one) => [one.rule, one.params])).toEqual([
      ['unknown-kind', { kind: 'epic' }],
      ['unknown-status', { status: 'reviewing' }],
    ]);
  });
});
