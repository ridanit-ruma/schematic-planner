import type { Messages } from '../en';

export const editor: Messages['editor'] = {
  hint: '/ でブロックを挿入するか、# 見出し、- リスト、[] ToDo のように Markdown で書けます。エージェントとエクスポートは Markdown として読み取ります。',
  placeholder: '入力するか、/ でブロックを挿入',
  summaryPlaceholder: 'トグル',
  label: '詳細',
  slash: {
    label: 'ブロックを挿入',
    noMatch: '該当するブロックはありません',
  },
  blocks: {
    paragraph: 'テキスト',
    heading1: '見出し 1',
    heading2: '見出し 2',
    heading3: '見出し 3',
    bulletList: '箇条書きリスト',
    orderedList: '番号付きリスト',
    taskList: 'ToDo リスト',
    quote: '引用',
    codeBlock: 'コード',
    divider: '区切り線',
    table: '表',
    toggle: 'トグル',
    callout: 'コールアウト',
  },
  callout: {
    type: 'コールアウトの種類',
    title: 'タイトル',
    variants: {
      note: 'メモ',
      tip: 'ヒント',
      warning: '注意',
      danger: '危険',
    },
  },
  table: {
    addRow: '行を追加',
    addColumn: '列を追加',
    deleteRow: '行を削除',
    deleteColumn: '列を削除',
    deleteTable: '表を削除',
  },
  drag: 'ドラッグしてブロックを移動',
  raw: 'Markdown',
  rawHint: 'エディタに対応するブロックがない Markdown のため、書かれたとおりに保持しています。',
};
