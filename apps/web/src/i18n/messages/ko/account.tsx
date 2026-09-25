import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const account: Messages['account'] = {
  layout: {
    title: '계정',
    tabAccount: '계정',
    tabKeys: 'MCP 키',
  },
  documentTitle: '계정',
  client: {
    unknown: '알 수 없는 클라이언트',
    unknownBrowser: '알 수 없는 브라우저',
    unknownPlatform: '알 수 없는 플랫폼',
    on: (browser: string, platform: string) => `${platform}의 ${browser}`,
  },
  picture: {
    title: '프로필 사진',
    body: '멤버 목록, 플랜 기록, 캔버스 위의 커서 등 내가 등장하는 모든 곳에 표시됩니다.',
    add: '사진 추가',
    replace: '변경',
    modalTitle: '프로필 사진',
  },
  avatarEditor: {
    unreadable: '이미지로 읽을 수 없는 파일입니다.',
    zoom: '확대',
    hint: (size: number) =>
      `사진을 드래그해 위치를 맞추세요. ${size}×${size} 정사각형으로 저장됩니다.`,
    saving: '저장 중…',
    save: '사진 저장',
  },
  name: {
    title: '이름',
    emailNote: (email: ReactNode) => (
      <>
        워크스페이스를 함께 쓰는 사람들에게 보이는 이름입니다. 이메일 주소는 {email}입니다. 이메일을
        바꾸려면 메일 발송 기능이 필요한데, 아직 만들어지지 않았습니다.
      </>
    ),
    label: '표시 이름',
  },
  password: {
    title: '비밀번호',
    body: '비밀번호를 바꾸면 이 세션을 제외한 모든 세션에서 로그아웃됩니다. 유출이 의심될 때 비밀번호를 바꾸는 이유가 바로 이것입니다.',
    current: '현재 비밀번호',
    new: '새 비밀번호',
    newHint: '10자 이상 입력하세요.',
    changed: '비밀번호를 변경했습니다',
    change: '비밀번호 변경',
  },
  sessions: {
    title: '로그인된 기기',
    body: '모르는 세션이 있으면 종료하세요. 지금 사용 중인 세션은 유지됩니다.',
    endOthers: '다른 세션 모두 종료',
    thisOne: '현재 세션',
    started: (when: string) => `${when} 로그인`,
    end: '종료',
  },
  remove: {
    title: '계정 삭제',
    body: '내가 소유한 모든 것이 함께 삭제됩니다. 내가 유일한 소유자인 워크스페이스와, 그 안의 모든 프로젝트와 플랜도 포함됩니다. 남겨 둘 것이 있다면 먼저 내보내세요.',
    button: '계정 삭제',
    modalTitle: '계정 삭제',
    modalDescription: '되돌릴 수 없습니다. 비밀번호를 입력해 확인하세요.',
    password: '비밀번호',
    confirm: '계정 삭제',
  },
};
