import type { Messages } from '../en';

export const shell: Messages['shell'] = {
  rail: {
    recent: '最近',
    projects: '项目',
    members: '成员',
    settings: '设置',
    trash: '回收站',
  },
  account: {
    menu: '账号',
    you: '你',
    settings: '账号设置',
    agentKeys: '智能体密钥',
    instance: '实例',
    signOut: '退出登录',
  },
  crumbs: {
    planSettings: '计划设置',
    recent: '最近',
    account: '账号',
    projects: '项目',
    members: '成员',
    settings: '设置',
    trash: '回收站',
  },
  workspaceSwitcher: {
    label: (name: string) => `切换工作区（当前：${name}）`,
    newWorkspace: '新建工作区',
    name: '名称',
    hint: '工作区里放项目，项目里放计划。',
    placeholder: '示例科技',
    create: '创建工作区',
  },
};
