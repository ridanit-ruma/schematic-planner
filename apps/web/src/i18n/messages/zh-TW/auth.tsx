import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const auth: Messages['auth'] = {
  documentTitle: {
    signIn: '登入',
    signUp: '建立帳號',
  },
  intro: {
    signIn: '登入以繼續你的計畫。',
    signUp: '建立帳號與工作區，開始規劃。',
  },
  name: '姓名',
  email: '電子郵件',
  password: '密碼',
  passwordHint: '至少 10 個字元。',
  invitation: {
    label: '邀請',
    byInvitation: '這裡需要受邀才能註冊。請向這個站台的管理者索取邀請連結。',
    fromLink: '來自你開啟的連結。',
  },
  submit: {
    signIn: '登入',
    signUp: '建立帳號',
  },
  switch: {
    noAccount: (link: ReactNode) => <>還沒有帳號嗎？{link}</>,
    createOne: '建立帳號',
    haveAccount: (link: ReactNode) => <>已經有帳號了嗎？{link}</>,
    signIn: '登入',
  },
};
