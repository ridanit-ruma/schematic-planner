import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { usePlanVocabulary } from './vocabulary';

function Probe() {
  return <>{String(usePlanVocabulary('plan-1').loaded)}</>;
}

/**
 * A server render runs no effects, so the plan's project is never asked for:
 * the moment before it answers, or the page where it never did.
 */
describe('usePlanVocabulary', () => {
  it('is not loaded until the plan’s project has answered', () => {
    expect(renderToString(<Probe />)).toBe('false');
  });
});
