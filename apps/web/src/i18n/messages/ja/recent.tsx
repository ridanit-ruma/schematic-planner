import type { Messages } from '../en';

export const recent: Messages['recent'] = {
  title: '最近',
  description: '参加しているすべてのワークスペースで、最近作業したものです。',
  empty: {
    title: 'まだ何も描かれていません',
    body: '開いたプランや、エージェントが変更したプランが新しい順にここに表示されます。',
  },
  columns: {
    plan: 'プラン',
    where: '場所',
    lastTouchedBy: '最終更新者',
    updated: '更新日時',
  },
  untitledPlan: '無題のプラン',
  firstWorkspace: {
    title: 'ワークスペースがありません',
    body: 'ワークスペースには、プロジェクトと、エージェントの接続に使うキーが入ります。',
    create: 'ワークスペースを作成',
    modalTitle: '新しいワークスペース',
    name: '名前',
    placeholder: '株式会社サンプル',
    submit: 'ワークスペースを作成',
  },
};
