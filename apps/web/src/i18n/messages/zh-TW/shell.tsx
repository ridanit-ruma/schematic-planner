import type { Messages } from '../en';

export const shell: Messages['shell'] = {
  rail: {
    recent: '最近',
    projects: '專案',
    members: '成員',
    settings: '設定',
    trash: '垃圾桶',
  },
  account: {
    menu: '帳號',
    you: '你',
    settings: '帳號設定',
    agentKeys: 'AI 代理金鑰',
    instance: '站台管理',
    signOut: '登出',
  },
  crumbs: {
    planSettings: '計畫設定',
    recent: '最近',
    account: '帳號',
    projects: '專案',
    members: '成員',
    settings: '設定',
    trash: '垃圾桶',
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
