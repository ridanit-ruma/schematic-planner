import type { Messages } from '../en';

export const shell: Messages['shell'] = {
  rail: {
    recent: '最近',
    projects: 'プロジェクト',
    members: 'メンバー',
    settings: '設定',
    trash: 'ゴミ箱',
  },
  account: {
    menu: 'アカウント',
    you: 'あなた',
    settings: 'アカウント設定',
    agentKeys: 'エージェントキー',
    instance: 'インスタンス',
    signOut: 'ログアウト',
  },
  crumbs: {
    planSettings: 'プラン設定',
    recent: '最近',
    account: 'アカウント',
    projects: 'プロジェクト',
    members: 'メンバー',
    settings: '設定',
    trash: 'ゴミ箱',
  },
  workspaceSwitcher: {
    label: (name: string) => `${name}（ワークスペースを切り替え）`,
    newWorkspace: '新しいワークスペース',
    name: '名前',
    hint: 'ワークスペースにはプロジェクトが、プロジェクトにはプランが入ります。',
    placeholder: '株式会社サンプル',
    create: 'ワークスペースを作成',
  },
};
