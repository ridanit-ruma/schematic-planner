import { describe, expect, it } from 'vitest';

import { josa, quoted } from './josa';

describe('josa', () => {
  it('follows the last Hangul syllable', () => {
    expect(josa('결제', '을')).toBe('결제를');
    expect(josa('완료', '이')).toBe('완료가');
    expect(josa('진행 중', '을')).toBe('진행 중을');
    expect(josa('서울', '으로')).toBe('서울로');
    expect(josa('휴지통', '으로')).toBe('휴지통으로');
  });

  it('reads digits and Latin words the way they are said', () => {
    expect(josa('v2', '을')).toBe('v2를');
    expect(josa('3', '이')).toBe('3이');
    expect(josa('API', '을')).toBe('API를');
    expect(josa('SQL', '으로')).toBe('SQL로');
    expect(josa('Cursor', '이')).toBe('Cursor가');
    expect(josa('sign-in', '을')).toBe('sign-in을');
  });

  it('writes both forms when it cannot tell', () => {
    expect(josa('🙂', '을')).toBe('🙂을(를)');
  });

  it('quotes a name and keeps the particle outside the quotes', () => {
    expect(quoted('결제', '을')).toBe('‘결제’를');
    expect(quoted('결제')).toBe('‘결제’');
  });
});
