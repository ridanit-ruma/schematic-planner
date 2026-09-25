import type { Messages } from '../en';

export const ui: Messages['ui'] = {
  author: {
    someone: '不明なユーザー',
    via: (name: string) => `（${name} 経由）`,
  },
  markdown: {
    task: 'タスク',
  },
  rowMenu: {
    actionsFor: (label: string) => `${label}の操作`,
  },
  notFound: {
    title: {
      page: 'このページは存在しません',
      plan: 'このプランは存在しません',
      sharedPlan: 'この共有プランは存在しません',
      project: 'このプロジェクトは存在しません',
      folder: 'このフォルダは存在しません',
      workspace: 'このワークスペースは存在しません',
    },
    body: 'このアドレスの先には、アクセスできるものがありません。最初から存在しなかったか、削除されたか、あなたに共有されていない誰かのものである可能性があります。',
    back: '作業中の画面に戻る',
  },
  api: {
    unreachable: (url: string) =>
      `${url} のサーバーに接続できませんでした。サーバーが停止しているか、このアドレスからの呼び出しが許可されていない可能性があります。`,
  },
};
