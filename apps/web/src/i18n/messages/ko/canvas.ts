import type { Messages } from '../en';
import { josa, quoted } from './josa';

export const canvas: Messages['canvas'] = {
  canvas: {
    menu: {
      addNode: '여기에 노드 추가',
      tidyUp: '간격 고르게 맞추기',
      duplicate: '복제',
      noteOnNode: '이 노드에 댓글 달기',
      noteHere: '여기에 댓글 달기',
      groupNodes: (count: number) => `노드 ${count}개를 그룹으로 묶기`,
      takeOutOf: (box: string) => `${quoted(box)}에서 꺼내기`,
      takeOutOfBox: '그룹에서 꺼내기',
      standardWidth: '기본 너비로',
      deleteNode: '노드 삭제',
      deleteConnection: '연결 삭제',
      undo: '실행 취소',
      redo: '다시 실행',
      fitPlan: '플랜 전체 보기',
      gridSpacing: '격자 간격',
      gridStep: (step: number) => `${step}px`,
      snapBy: '맞춤 기준',
      snapTerminals: '연결점',
      snapOuterEdge: '바깥 테두리',
      hideResolved: (count: number) => `해결된 댓글 ${count}개 숨기기`,
      showResolved: (count: number) => `해결된 댓글 ${count}개 보기`,
    },
    grid: {
      snap: '격자에 맞추기',
      stopSnapping: '격자에 맞추지 않기',
      snappingTo: (step: number) => `${step}px 격자에 맞추는 중`,
      notSnapping: '격자에 맞추지 않음',
    },
    card: {
      untitled: '제목 없음',
      title: '노드 제목',
    },
    spacing: {
      handle: '끌어서 간격 조정',
    },
    readingFrom: (by: string, from: string) =>
      `${josa(by, '이')} ${quoted(from)}부터 읽고 있습니다`,
  },
};
