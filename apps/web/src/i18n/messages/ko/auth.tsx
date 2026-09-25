import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const auth: Messages['auth'] = {
  documentTitle: {
    signIn: '로그인',
    signUp: '계정 만들기',
  },
  intro: {
    signIn: '로그인하고 플랜으로 돌아가세요.',
    signUp: '계정을 만들고, 플랜을 그릴 워크스페이스를 준비합니다.',
  },
  name: '이름',
  email: '이메일',
  password: '비밀번호',
  passwordHint: '10자 이상 입력하세요.',
  invitation: {
    label: '초대',
    byInvitation:
      '이곳은 초대를 받아야 가입할 수 있습니다. 이 인스턴스의 운영자에게 초대 링크를 요청하세요.',
    fromLink: '열어 본 링크에서 가져왔습니다.',
  },
  submit: {
    signIn: '로그인',
    signUp: '계정 만들기',
  },
  switch: {
    noAccount: (link: ReactNode) => <>계정이 없으신가요? {link}</>,
    createOne: '계정 만들기',
    haveAccount: (link: ReactNode) => <>이미 계정이 있으신가요? {link}</>,
    signIn: '로그인',
  },
};
