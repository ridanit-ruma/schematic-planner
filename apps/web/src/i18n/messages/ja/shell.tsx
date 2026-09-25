import type { Messages } from '../en';

export const shell: Messages['shell'] = {
  account: {
    menu: 'アカウント',
    you: 'あなた',
    settings: 'アカウント設定',
    agentKeys: 'エージェントキー',
    instance: 'インスタンス',
    signOut: 'ログアウト',
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
