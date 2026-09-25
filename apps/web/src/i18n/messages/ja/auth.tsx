import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const auth: Messages['auth'] = {
  documentTitle: {
    signIn: 'ログイン',
    signUp: 'アカウントを作成',
  },
  intro: {
    signIn: 'ログインしてプランを開きます。',
    signUp: 'アカウントとワークスペースを用意して、プランづくりを始めましょう。',
  },
  name: '名前',
  email: 'メールアドレス',
  password: 'パスワード',
  passwordHint: '10文字以上。',
  invitation: {
    label: '招待',
    byInvitation:
      'このインスタンスへの登録は招待制です。運営している方に招待リンクを依頼してください。',
    fromLink: '開いたリンクから入力済みです。',
  },
  submit: {
    signIn: 'ログイン',
    signUp: 'アカウントを作成',
  },
  switch: {
    noAccount: (link: ReactNode) => <>アカウントをお持ちでない方は{link}</>,
    createOne: 'こちらから作成',
    haveAccount: (link: ReactNode) => <>すでにアカウントをお持ちの方は{link}</>,
    signIn: 'ログイン',
  },
};
