/**
 * Korean particles change with the sound the word before them ends on (을/를,
 * 이/가, 으로/로), and a name filled in at run time can end on anything. This
 * picks the form from the last Hangul syllable, digit or Latin letter, and falls
 * back to the written-out pair when it cannot tell.
 */
type Ending = 'vowel' | 'rieul' | 'consonant' | null;

// How each digit is read: 영 일 이 삼 사 오 육 칠 팔 구.
const DIGITS: readonly Ending[] = [
  'consonant',
  'rieul',
  'vowel',
  'consonant',
  'vowel',
  'vowel',
  'consonant',
  'rieul',
  'rieul',
  'vowel',
];

function ending(word: string): Ending {
  const trimmed = word.replace(/[^\p{L}\p{N}]+$/u, '');
  const last = trimmed.at(-1);
  if (last === undefined) return null;

  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const final = (code - 0xac00) % 28;
    return final === 0 ? 'vowel' : final === 8 ? 'rieul' : 'consonant';
  }
  if (/[0-9]/.test(last)) return DIGITS[Number(last)] ?? null;

  const token = /[A-Za-z]+$/.exec(trimmed)?.[0];
  if (token === undefined) return null;
  // An acronym is read letter by letter: L and R end on ㄹ, M and N on a consonant.
  if (token.length > 1 && token === token.toUpperCase()) {
    return /[LR]$/.test(token) ? 'rieul' : /[MN]$/.test(token) ? 'consonant' : 'vowel';
  }
  const lower = token.toLowerCase();
  if (/(l|le)$/.test(lower)) return 'rieul';
  if (/(m|n|ng|me|ne)$/.test(lower)) return 'consonant';
  if (/[aeiou](ck|[bkpt])$/.test(lower)) return 'consonant';
  return 'vowel';
}

const FORMS = {
  을: ['을', '를', '을(를)'],
  이: ['이', '가', '이(가)'],
  으로: ['으로', '로', '(으)로'],
} as const;

/** `word` followed by the form of the particle that fits it. */
export function josa(word: string, particle: keyof typeof FORMS): string {
  const [afterConsonant, afterVowel, unknown] = FORMS[particle];
  const end = ending(word);
  if (end === null) return `${word}${unknown}`;
  if (particle === '으로' && end === 'rieul') return `${word}${afterVowel}`;
  return `${word}${end === 'vowel' ? afterVowel : afterConsonant}`;
}

/** A name set off in quotes, with the particle that fits it. */
export function quoted(word: string, particle?: keyof typeof FORMS): string {
  const particleOnly = particle === undefined ? '' : josa(word, particle).slice(word.length);
  return `‘${word}’${particleOnly}`;
}
