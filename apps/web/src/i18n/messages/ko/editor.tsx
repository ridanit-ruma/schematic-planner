import type { Messages } from '../en';

export const editor: Messages['editor'] = {
  hint: '/를 입력해 블록을 넣거나 # 제목, - 목록, [] 할 일처럼 Markdown으로 쓸 수 있습니다. 에이전트와 내보내기는 Markdown으로 읽습니다.',
  placeholder: '내용을 쓰거나 /를 입력해 블록을 넣으세요',
  summaryPlaceholder: '토글',
  label: '내용',
  slash: {
    label: '블록 넣기',
    noMatch: '해당하는 블록이 없습니다',
  },
  blocks: {
    paragraph: '텍스트',
    heading1: '제목 1',
    heading2: '제목 2',
    heading3: '제목 3',
    bulletList: '글머리 기호 목록',
    orderedList: '번호 목록',
    taskList: '할 일 목록',
    quote: '인용',
    codeBlock: '코드',
    divider: '구분선',
    table: '표',
    toggle: '토글',
    callout: '콜아웃',
  },
  callout: {
    type: '콜아웃 종류',
    title: '제목',
    variants: {
      note: '메모',
      tip: '팁',
      warning: '주의',
      danger: '위험',
    },
  },
  table: {
    addRow: '행 추가',
    addColumn: '열 추가',
    deleteRow: '행 삭제',
    deleteColumn: '열 삭제',
    deleteTable: '표 삭제',
  },
  drag: '끌어서 블록 옮기기',
  raw: 'Markdown',
  rawHint: '편집기에 맞는 블록이 없는 Markdown이라 쓴 그대로 보관합니다.',
};
