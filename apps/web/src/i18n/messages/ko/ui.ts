import type { Messages } from '../en';

export const ui: Messages['ui'] = {
  author: {
    someone: '누군가',
    via: (name: string) => ` · ${name}의 키`,
  },
  markdown: {
    task: '할 일',
  },
  rowMenu: {
    actionsFor: (label: string) => `${label} 메뉴`,
  },
  notFound: {
    title: {
      page: '페이지를 찾을 수 없습니다',
      plan: '플랜을 찾을 수 없습니다',
      sharedPlan: '공유된 플랜을 찾을 수 없습니다',
      project: '프로젝트를 찾을 수 없습니다',
      folder: '폴더를 찾을 수 없습니다',
      workspace: '워크스페이스를 찾을 수 없습니다',
    },
    body: '이 주소로 열 수 있는 곳이 없습니다. 처음부터 없었거나, 삭제되었거나, 아직 공유받지 않은 다른 사람의 것일 수 있습니다.',
    back: '작업하던 곳으로 돌아가기',
  },
  api: {
    unreachable: (url: string) =>
      `서버(${url})에 연결할 수 없습니다. 서버가 꺼져 있거나, 이 주소에서의 요청이 허용되지 않았을 수 있습니다.`,
  },
};
