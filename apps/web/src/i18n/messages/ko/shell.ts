import type { Messages } from '../en';

export const shell: Messages['shell'] = {
  rail: {
    recent: '최근',
    projects: '프로젝트',
    members: '멤버',
    settings: '설정',
    trash: '휴지통',
  },
  account: {
    menu: '계정',
    you: '나',
    settings: '계정 설정',
    agentKeys: '에이전트 키',
    instance: '인스턴스',
    signOut: '로그아웃',
  },
  crumbs: {
    planSettings: '플랜 설정',
    recent: '최근',
    account: '계정',
    projects: '프로젝트',
    members: '멤버',
    settings: '설정',
    trash: '휴지통',
  },
  workspaceSwitcher: {
    label: (name: string) => `${name} — 워크스페이스 전환`,
    newWorkspace: '새 워크스페이스',
    name: '이름',
    hint: '워크스페이스에는 프로젝트가, 프로젝트에는 플랜이 담깁니다.',
    placeholder: '우리 팀',
    create: '워크스페이스 만들기',
  },
};
