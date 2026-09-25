import type { Messages } from '../en';

export const recent: Messages['recent'] = {
  title: '최근',
  description: '참여 중인 모든 워크스페이스에서 최근에 작업한 플랜입니다.',
  empty: {
    title: '아직 그린 플랜이 없습니다',
    body: '직접 연 플랜이나 에이전트가 수정한 플랜이 최신순으로 여기에 표시됩니다.',
    open: (workspace: string) => `${workspace} 열기`,
  },
  columns: {
    plan: '플랜',
    where: '위치',
    lastTouchedBy: '마지막 수정자',
    updated: '수정일',
  },
  untitledPlan: '제목 없는 플랜',
  firstWorkspace: {
    title: '아직 워크스페이스가 없습니다',
    body: '워크스페이스에는 프로젝트와, 에이전트가 연결할 때 쓰는 키가 담깁니다.',
    create: '워크스페이스 만들기',
    modalTitle: '새 워크스페이스',
    name: '이름',
    placeholder: '우리 팀',
    submit: '워크스페이스 만들기',
  },
};
