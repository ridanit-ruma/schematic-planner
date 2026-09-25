import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const auth: Messages['auth'] = {
  documentTitle: {
    signIn: '登录',
    signUp: '创建账号',
  },
  intro: {
    signIn: '登录以查看你的计划。',
    signUp: '创建账号和工作区，开始规划。',
  },
  name: '名称',
  email: '邮箱',
  password: '密码',
  passwordHint: '至少 10 个字符。',
  invitation: {
    label: '邀请',
    byInvitation: '此处仅限受邀注册。请向此实例的管理者索取邀请链接。',
    fromLink: '来自你打开的链接。',
  },
  submit: {
    signIn: '登录',
    signUp: '创建账号',
  },
  switch: {
    noAccount: (link: ReactNode) => <>还没有账号？{link}</>,
    createOne: '立即注册',
    haveAccount: (link: ReactNode) => <>已有账号？{link}</>,
    signIn: '登录',
  },
};
