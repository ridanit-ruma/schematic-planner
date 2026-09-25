import type { Messages } from '../en';

export const agents: Messages['agents'] = {
  documentTitle: 'エージェント',
  intro:
    'Cursor や Claude など、任意の MCP クライアントを接続できます。キーはワークスペースではなくあなた自身に属するため、1つのキーで参加しているすべてのワークスペースにアクセスできます。エージェントはあなたのプランを読み、あなたが見ているのと同じキャンバスに新しいプランを描けます。',
  server: {
    title: 'サーバー URL',
    body: 'このインスタンスの全員に共通です。下のキーと組み合わせて使います。',
  },
  keys: {
    title: 'キー',
    body: 'キーは、あなたがメンバーであるすべての場所で、あなたとして動作します。無効にするとすぐに使えなくなります。',
    newKey: '新しいキー',
    empty: {
      title: 'キーがありません',
      body: '最初のエージェントを接続するには、キーを作成してください。',
    },
    columns: {
      name: '名前',
      key: 'キー',
      lastUsed: '最終使用',
      actions: '操作',
    },
    neverUsed: '未使用',
    never: 'なし',
    limitedTo: (scope: string) => `${scope}のみ`,
    revoke: '無効化',
  },
  create: {
    title: '新しいキー',
    name: '名前',
    nameHint: 'どのマシンやツールで使うキーかがわかる名前にします。',
    namePlaceholder: 'ノートPCの Cursor',
    submit: 'キーを作成',
  },
  issued: {
    title: 'キーを今すぐコピーしてください',
    description:
      'キーが表示されるのはこの一度だけです。サーバーにはキーではなくハッシュが保存されます。',
    configTitle: 'MCP クライアントの設定',
    configBody:
      'クライアントの MCP 設定に貼り付けてください。セットアップはこのコピーだけで完了します。インストールするものはありません。',
  },
  copyConfiguration: '設定をコピー',
  copy: 'コピー',
};
