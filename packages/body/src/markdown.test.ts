import { describe, expect, it } from 'vitest';

import { markdownToDoc, markdownToJSON } from './parse.js';
import { docToMarkdown, jsonToMarkdown } from './serialize.js';

const roundTrip = (markdown: string): string => docToMarkdown(markdownToDoc(markdown));

/**
 * Markdown already in the form the serialiser writes. Each one must come back
 * byte for byte, through the schema, or an unchanged body would read as edited.
 */
const CANONICAL: Record<string, string> = {
  empty: '',
  paragraph: 'A plain paragraph.',
  'soft line breaks': 'First line\nsecond line\nthird line',
  'hard break': 'Before\\\nafter',
  paragraphs: 'One.\n\nTwo.',
  headings: '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six',
  marks: 'Some **bold**, *italic*, ~~struck~~ and `code`.',
  'nested marks': '**bold *and italic* inside**',
  'bold italic': '***both***',
  link: 'See [the docs](https://example.com/docs) now.',
  'link with title': '[docs](https://example.com "The docs")',
  'code in a link': '[`api`](https://example.com/api)',
  'bold link': '[**strong link**](https://example.com)',
  'escaped characters': 'A literal \\*star\\* and \\[bracket]\n\\# not a heading\n1\\. not a list',
  bullets: '- one\n- two\n- three',
  'nested bullets': '- one\n  - one a\n  - one b\n- two',
  numbers: '1. one\n2. two\n3. three',
  'numbers from five': '5. five\n6. six',
  tasks: '- [ ] open\n- [x] done',
  'nested tasks': '- [ ] parent\n  - [x] child',
  quote: '> Quoted\n> still quoted',
  'quote with list': '> - a\n> - b',
  'code block': '```ts\nconst a = 1;\n\nconst b = 2;\n```',
  'code block with meta': '```ts title="a.ts"\nlet x;\n```',
  'code block without language': '```\nplain\n```',
  divider: 'Above\n\n---\n\nBelow',
  table: '| Name | Role |\n| - | - |\n| Ada | Engine |\n| Grace | Compiler |',
  'aligned table': '| Left | Centre | Right |\n| :- | :-: | -: |\n| a | b | c |',
  'table with marks':
    '| **Bold** | `code` |\n| - | - |\n| [link](https://example.com) | a \\| pipe |',
  'table with a break': '| a<br>b |\n| - |\n| c |',
  toggle: '<details>\n<summary>More</summary>\n\nHidden paragraph.\n\n- and a list\n\n</details>',
  'toggle with escaped summary':
    '<details>\n<summary>a &lt; b &amp; c</summary>\n\nx\n\n</details>',
  'nested toggle':
    '<details>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\ndeep\n\n</details>\n\n</details>',
  callout: '> [!note] Title\n> Body text.',
  'callout without title': '> [!warning]\n> Careful.',
  'callout with blocks': '> [!tip] Tip\n> Body.\n>\n> - one\n> - two',
  'callout starting with a list': '> [!danger] Stop\n>\n> - one',
  'callout with fold': '> [!note]- Folded\n> Hidden.',
  'callout with marked title': '> [!tip] **Why** it matters\n> Because.',
  'raw image': '![alt](https://example.com/a.png)',
  'raw html': '<div align="center">centred</div>',
  'mixed document':
    '# Plan\n\nIntro with **bold**.\n\n- [ ] first\n- [x] second\n\n> [!note] Heads up\n> Read this.\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n<details>\n<summary>Why</summary>\n\nBecause.\n\n</details>',
};

describe('round trip', () => {
  for (const [name, markdown] of Object.entries(CANONICAL)) {
    it(`keeps ${name}`, () => {
      expect(roundTrip(markdown)).toBe(markdown);
    });
  }

  it('is stable after one pass for markdown written some other way', () => {
    const loose = [
      '* star bullets\n* more',
      '+ plus',
      '__bold__ and _italic_',
      'Setext\n======',
      '    indented code',
      '1) paren\n2) list',
      '- loose\n\n- list',
      'trailing spaces  \nhard break',
      '| a | b |\n|---|---|\n| 1 |',
      '<details><summary>One line</summary>inside</details>',
      '<details>\n<summary>No blank</summary>\nText\n</details>',
      '> [!NOTE]\n> GitHub style',
      'https://example.com bare',
      '~~~\ntilde\n~~~',
      '- a\n- [ ] mixed',
      '1. [ ] ordered task',
      'text with ![image](a.png) inside',
      'A [ref][r] link\n\n[r]: https://example.com',
      'Footnote[^1]\n\n[^1]: note',
      '<!-- comment -->',
      '<details>\n<summary>unclosed</summary>\n\nstays',
      '- # heading in a list',
    ];
    for (const markdown of loose) {
      const once = roundTrip(markdown);
      expect(roundTrip(once), markdown).toBe(once);
    }
  });
});

describe('normalising', () => {
  it.each([
    ['* star', '- star'],
    ['__bold__ and _italic_', '**bold** and *italic*'],
    ['Setext\n======', '# Setext'],
    ['    indented', '```\nindented\n```'],
    ['|a|b|\n|---|---|\n|1|2|', '| a | b |\n| - | - |\n| 1 | 2 |'],
    ['| a | b |\n|---|---|\n| 1 |', '| a | b |\n| - | - |\n| 1 | |'],
    ['- loose\n\n- list', '- loose\n- list'],
    ['> [!NOTE]\n> GitHub style', '> [!NOTE]\n> GitHub style'],
    [
      '<details><summary>One line</summary>inside</details>',
      '<details>\n<summary>One line</summary>\n\ninside\n\n</details>',
    ],
    [
      '<details>\n<summary>No blank</summary>\nText\n</details>',
      '<details>\n<summary>No blank</summary>\n\nText\n\n</details>',
    ],
  ])('%j becomes %j', (input, output) => {
    expect(roundTrip(input)).toBe(output);
  });
});

describe('what the schema cannot hold', () => {
  it.each([
    ['an image', '![alt](https://example.com/a.png)'],
    ['an image inside a paragraph', 'Text with ![alt](a.png) inside.'],
    ['raw HTML', '<div>\n<b>hi</b>\n</div>'],
    ['a comment', '<!-- note to self -->'],
    ['a reference link', 'A [ref][r] link.\n\n[r]: https://example.com'],
    ['a footnote', 'Claim[^1].\n\n[^1]: Source.'],
    ['a numbered task list', '1. [ ] first\n2. [x] second'],
    ['a list mixing tasks and bullets', '- [ ] task\n- bullet'],
    ['an unclosed toggle', '<details>\n<summary>Open</summary>\n\nstill here'],
    ['a list item that opens with a heading', '- # Heading'],
    ['an image in a quote', '> ![alt](a.png)'],
  ])('keeps %s as a code block of its Markdown', (_name, markdown) => {
    const json = markdownToJSON(markdown);
    expect(JSON.stringify(json)).toContain('rawMarkdown');
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it('keeps only the block it could not hold as source', () => {
    const json = markdownToJSON('# Title\n\n![alt](a.png)\n\nAfter.');
    expect(json.content?.map((node) => node.type)).toEqual(['heading', 'rawMarkdown', 'paragraph']);
  });

  it('never loses text', () => {
    const markdown = 'Intro\n\n<span>inline html</span> and text\n\n- item';
    expect(roundTrip(markdown)).toBe(markdown);
  });
});

describe('document shape', () => {
  it('reads blocks into the node types the editor uses', () => {
    const json = markdownToJSON(CANONICAL['mixed document']!);
    expect(json.content?.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'taskList',
      'callout',
      'table',
      'details',
    ]);
  });

  it('reads a callout title from the source line', () => {
    const json = markdownToJSON('> [!tip] **Why** it matters\n> Because.');
    expect(json.content?.[0]?.attrs).toEqual({
      variant: 'tip',
      fold: '',
      title: '**Why** it matters',
    });
  });

  it('writes an empty document as nothing', () => {
    expect(jsonToMarkdown({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
    expect(jsonToMarkdown({ type: 'doc' })).toBe('');
  });

  it('drops empty paragraphs between blocks', () => {
    expect(
      jsonToMarkdown({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
          { type: 'paragraph' },
          { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
        ],
      }),
    ).toBe('a\n\nb');
  });

  it('escapes what would otherwise become syntax', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '# not a heading *or* [link]' }] },
      ],
    };
    const markdown = jsonToMarkdown(doc);
    expect(markdownToJSON(markdown)).toEqual(doc);
  });

  it('writes marks that do not nest neatly as valid Markdown', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'b', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: 'c', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    };
    expect(markdownToJSON(jsonToMarkdown(doc))).toEqual(doc);
  });
});
