import type { Messages } from '../en';

export const agents: Messages['agents'] = {
  documentTitle: '에이전트',
  intro:
    'Cursor, Claude 등 MCP 클라이언트를 연결하세요. 키는 특정 워크스페이스가 아니라 내 계정에 속하므로, 키 하나로 내가 멤버인 모든 워크스페이스에 접근할 수 있습니다. 에이전트는 내 플랜을 읽고, 지금 보고 있는 바로 그 캔버스에 새 플랜을 그릴 수 있습니다.',
  server: {
    title: '서버 URL',
    body: '이 인스턴스의 모든 사용자에게 같은 주소입니다. 아래의 키와 함께 사용하세요.',
  },
  keys: {
    title: '키',
    body: '키는 내가 멤버인 모든 곳에서 나로서 동작합니다. 폐기하면 즉시 사용할 수 없게 됩니다.',
    newKey: '새 키',
    empty: {
      title: '아직 키가 없습니다',
      body: '키를 만들어 첫 에이전트를 연결하세요.',
    },
    columns: {
      name: '이름',
      key: '키',
      lastUsed: '마지막 사용',
      actions: '관리',
    },
    neverUsed: '사용 기록 없음',
    never: '없음',
    limitedTo: (scope: string) => `${scope} 전용`,
    revoke: '폐기',
  },
  create: {
    title: '새 키',
    name: '이름',
    nameHint: '어느 기기나 도구에서 쓰는 키인지 알 수 있게 지으세요.',
    namePlaceholder: '내 노트북의 Cursor',
    submit: '키 만들기',
  },
  issued: {
    title: '지금 키를 복사하세요',
    description: '키는 지금 한 번만 표시됩니다. 서버에는 키가 아니라 해시만 저장됩니다.',
    configTitle: 'MCP 클라이언트 설정',
    configBody:
      '클라이언트의 MCP 설정에 붙여 넣으세요. 이것만 복사하면 설정이 끝나며, 따로 설치할 것은 없습니다.',
  },
  copyConfiguration: '설정 복사',
  copy: '복사',
};
