import type { Messages } from '../en';

export const shell: Messages['shell'] = {
  account: {
    menu: '帳號',
    you: '你',
    settings: '帳號設定',
    agentKeys: 'AI 代理金鑰',
    instance: '站台管理',
    signOut: '登出',
  },
  workspaceSwitcher: {
    label: (name: string) => `${name}：切換工作區`,
    newWorkspace: '新增工作區',
    name: '名稱',
    hint: '工作區裡有專案，專案裡有計畫。',
    placeholder: '晨光工作室',
    create: '建立工作區',
  },
};
