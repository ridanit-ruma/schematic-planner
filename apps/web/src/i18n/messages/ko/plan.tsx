import type { ReactNode } from 'react';

import type { Messages } from '../en';
import { josa, quoted } from './josa';

/** Stands in for a subject with no name; it reads as it is, not as a quoted name. */
const THIS_PLAN = '이 플랜';

/** A subject in a history line: quoted when it is a name, bare when it is `THIS_PLAN`. */
const subject = (name: string, particle?: '을' | '이' | '으로'): string => {
  if (name !== THIS_PLAN) return quoted(name, particle);
  return particle === undefined ? name : josa(name, particle);
};

export const plan: Messages['plan'] = {
  labels: {
    nodeKind: {
      feature: '기능',
      task: '작업',
      decision: '결정',
      note: '메모',
      group: '그룹',
    },
    status: {
      idea: '아이디어',
      planned: '계획됨',
      in_progress: '진행 중',
      blocked: '막힘',
      done: '완료',
      dropped: '중단',
    },
    edgeKind: {
      flows_to: '흐름',
      depends_on: '의존',
      contains: '포함',
      relates_to: '관련',
    },
    edgeMeaning: {
      flows_to:
        '제어나 데이터가 이 방향으로 이동합니다. 응답은 반대 방향을 가리키는 별도의 흐름으로 그립니다.',
      depends_on: '두 노드의 순서를 정합니다. 내보낼 때 각 파일 이름 앞의 번호가 됩니다.',
      contains: '한쪽을 다른 쪽 안에 넣습니다. 내보낼 때 디렉터리가 됩니다.',
      relates_to: '단순한 관련입니다. 구조에는 영향을 주지 않습니다.',
    },
  },
  inspector: {
    title: '제목',
    identifier: '식별자',
    identifierClash: '다른 노드가 이미 쓰고 있는 식별자입니다',
    identifierMalformed: '소문자 단어를 하이픈 하나로 이어 주세요',
    identifierHint: '에이전트가 이 노드를 가리킬 때 쓰며, 내보낼 때 파일 이름이 됩니다',
    kind: '종류',
    status: '상태',
    tags: '태그',
    tagsHint: '쉼표로 구분',
    detail: '내용',
    detailHint: 'Markdown 형식이며, 캔버스에도 Markdown으로 표시됩니다',
    nothingYet: '아직 없음',
    deleteNode: '노드 삭제',
    deleteNodeNote: '노드와 여기에 이어진 연결을 모두 삭제합니다.',
  },
  edgeInspector: {
    connection: '연결',
    meaning: '의미',
    setOffBy: '트리거',
    setOffByHint: '무엇으로 시작되는지 적습니다. 클릭, 라우트, 요청, 타이머 등.',
    setOffByPlaceholder: '로그인 버튼 클릭',
    carries: '전달 내용',
    carriesHint: '이 연결을 따라 전달되는 것. 페이로드, 레코드, 반환값 등.',
    label: '레이블',
    labelHint: '선 위에 표시됩니다. 선택 사항입니다.',
    straighten: '직선으로',
    removeConnection: '연결 삭제',
  },
  history: {
    title: '기록',
    empty: '아직 없습니다. 누가 바꾸든 이 플랜의 모든 변경이 여기에 기록됩니다.',
    fewer: '접기',
    eachOne: '하나씩 보기',
    /** Who did it, then what they did. */
    entry: (author: ReactNode, line: string) => (
      <>
        {author} {line}
      </>
    ),
    /** Stands in for the subject when a change to the plan itself carries no name. */
    thisPlan: THIS_PLAN,
    /** The value a status change ended on, keyed by the status. */
    statusWord: {
      idea: '아이디어',
      planned: '계획됨',
      in_progress: '진행 중',
      blocked: '막힘',
      done: '완료',
      dropped: '중단',
    } as Record<string, string>,
    /** The value a kind change ended on, keyed by the kind. */
    kindWord: {
      feature: '기능',
      task: '작업',
      decision: '결정',
      note: '메모',
      group: '그룹',
    } as Record<string, string>,
    change: {
      planCreated: (nodes: string | null) =>
        nodes === null ? '플랜을 만들었습니다' : `노드 ${nodes}개로 플랜을 만들었습니다`,
      planTitle: (name: string) => `플랜 이름을 ${subject(name, '으로')} 바꿨습니다`,
      planDescription: '플랜 설명을 작성했습니다',
      planArranged: (count: string | null) =>
        count === null ? '노드 몇 개를 옮겼습니다' : `노드 ${count}개를 옮겼습니다`,
      nodeAdded: (name: string) => `${subject(name, '을')} 추가했습니다`,
      nodeRemoved: (name: string) => `${subject(name, '을')} 삭제했습니다`,
      nodeIdentifier: (name: string, slug: string) =>
        `${subject(name)}의 식별자를 ${josa(slug, '으로')} 바꿨습니다`,
      nodeRenamed: (from: string | null, name: string) =>
        `${from === null ? '노드' : subject(from)} 이름을 ${subject(name, '으로')} 바꿨습니다`,
      nodeStatus: (name: string, status: string | null) =>
        status === null
          ? `${subject(name)} 상태를 바꿨습니다`
          : `${subject(name)} 상태를 ${josa(status, '으로')} 바꿨습니다`,
      nodeKind: (name: string, kind: string | null) =>
        kind === null
          ? `${subject(name)} 종류를 바꿨습니다`
          : `${subject(name)} 종류를 ${josa(kind, '으로')} 바꿨습니다`,
      nodeBody: (name: string) => `${subject(name)} 내용을 수정했습니다`,
      nodeTagsCleared: (name: string) => `${subject(name)} 태그를 모두 지웠습니다`,
      nodeTags: (name: string, tags: string) => `${subject(name)}에 태그를 달았습니다: ${tags}`,
      nodeMetaCleared: (name: string) => `${subject(name)}의 추가 필드를 지웠습니다`,
      nodeMeta: (name: string, fields: string) =>
        `${subject(name)}의 추가 필드를 설정했습니다: ${fields}`,
      edgeAdded: (name: string) => `${subject(name)} 연결을 추가했습니다`,
      edgeRemoved: (name: string) => `${subject(name)} 연결을 삭제했습니다`,
      noteAdded: (name: string) => `${subject(name)}에 댓글을 남겼습니다`,
      noteRemoved: (name: string) => `${subject(name)}의 댓글을 삭제했습니다`,
      noteEdited: (name: string) => `${subject(name)}의 댓글을 수정했습니다`,
      noteAnswered: (name: string) => `${subject(name)}의 댓글에 답했습니다`,
      noteResolved: (name: string) => `${subject(name)}의 댓글을 해결했습니다`,
      noteReopened: (name: string) => `${subject(name)}의 댓글을 다시 열었습니다`,
      other: (name: string) => `${subject(name, '을')} 변경했습니다`,
    },
    /** A folded batch, counted: `+41 nodes, +62 connections`. `change` is the signed counts. */
    summary: {
      nodes: (change: string, _total: number) => `노드 ${change}`,
      connections: (change: string, _total: number) => `연결 ${change}`,
      notes: (change: string, _total: number) => `댓글 ${change}`,
      edits: (count: number) => `수정 ${count}건`,
      separator: ', ',
      madeChanges: '몇 가지를 변경했습니다',
    },
  },
  comments: {
    someone: '누군가',
    placeholder: '의견을 남겨 주세요',
    empty: '빈 댓글',
    reopen: '다시 열기',
    resolve: '해결',
    deleteNote: '댓글 삭제',
  },
  titleBlock: {
    planSettings: '플랜 설정',
    nextNote: '다음 미해결 댓글로 이동',
    addNode: '노드 추가',
    planActions: '플랜 메뉴',
    arrange: '자동 배치',
    share: '공유',
    history: '기록',
    hideHistory: '기록 숨기기',
    export: '내보내기',
    onlyYou: '나만 보고 있음',
    peopleHere: (count: number) => `${count}명이 보는 중`,
    you: '나',
    nodeCount: (count: number) => `노드 ${count}개`,
    connected: '연결됨',
    connecting: '연결 중',
    disconnected: '연결 끊김 — 다시 연결될 때까지 변경 사항은 이 기기에만 남습니다',
  },
  page: {
    untitled: '제목 없는 플랜',
    addNode: '노드 추가',
    title: '제목',
    titleHint: '식별자는 제목을 바탕으로 만들어지며, 나중에 바꿀 수 있습니다.',
    titlePlaceholder: '인증',
    shareTitle: '플랜 공유',
    shareDescription:
      '링크가 있으면 누구나 이 플랜을 보고 내보내기 파일을 내려받을 수 있습니다. 수정은 할 수 없습니다.',
    stopSharing: '공유 중지',
    copyLink: '링크 복사',
  },
  settings: {
    title: '플랜 설정',
    description: '캔버스 밖에서 다루는 이 플랜의 모든 설정입니다.',
    openCanvas: '캔버스 열기',
    name: {
      title: '이름',
      description: '모든 목록과 캔버스에 표시되는 이름입니다.',
      titleField: '제목',
      descriptionField: '설명',
      descriptionHint: '목록에서 제목 아래에 표시되는 한 줄 설명입니다.',
    },
    location: {
      title: '위치',
      description: '플랜을 옮겨도 주소는 그대로이므로, 이 플랜으로 향하는 링크는 모두 유지됩니다.',
      workspace: '워크스페이스',
      project: '프로젝트',
      noProject: '이 워크스페이스에는 옮겨 넣을 프로젝트가 없습니다.',
      leaving: (workspace: string) =>
        `${workspace} 밖으로 옮기면 그곳의 모든 사람이 이 플랜에 접근할 수 없게 되고, 공유 링크도 해제됩니다. 공유 링크는 누가 이 플랜에 접근할 수 있는지를 전제로 건넨 것이기 때문입니다.`,
      move: '옮기기',
    },
    trash: {
      title: '플랜 삭제',
      description:
        '워크스페이스 휴지통으로 이동하며, 그곳에서 복원하거나 완전히 삭제할 수 있습니다.',
      moveToTrash: '휴지통으로 이동',
      confirmTitle: (title: string) => `${quoted(title, '을')} 휴지통으로 옮길까요?`,
      confirmDescription: '목록 어디에도 더 이상 표시되지 않습니다. 휴지통에서 복원할 수 있습니다.',
    },
    in: (workspace: ReactNode) => <>{workspace} 워크스페이스에 있습니다.</>,
  },
  shared: {
    goHome: 'Schematic Planner로 이동',
    readOnly: '읽기 전용',
    export: '내보내기',
  },
  group: {
    /** What a group is called before anybody names it. */
    defaultTitle: '그룹',
  },
};
