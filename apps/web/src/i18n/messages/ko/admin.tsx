import type { ReactNode } from 'react';

import type { Messages } from '../en';
import { quoted } from './josa';

export const admin: Messages['admin'] = {
  layout: {
    title: '인스턴스',
    body: '워크스페이스 하나가 아니라 이 배포 전체에 관한 내용입니다.',
    tabUsage: '사용량',
    tabInvitations: '초대',
    tabPeople: '사용자',
  },
  actions: '관리',
  invitations: {
    documentTitle: '초대',
    intro:
      '링크가 있으면 이곳에 계정을 만들 수 있습니다. 코드 하나를 모두에게 알려 주기보다 사람마다 링크를 따로 주세요. 링크는 인원을 제한하거나 회수할 수 있고, 나중에 누가 어느 링크로 들어왔는지도 구분할 수 있습니다.',
    newLink: '새 링크',
    code: {
      title: '가입 코드',
      body: (variable: ReactNode) => (
        <>
          이 배포의 설정에 지정된 값입니다. 코드를 아는 사람은 링크 없이 몇 번이든 계정을 만들 수
          있으며, 그 사실은 여기에 기록되지 않습니다. 이 경로를 막으려면 {variable} 값을 비우세요.
        </>
      ),
    },
    copied: '복사됨',
    copy: '복사',
    empty: {
      noneOpen: '유효한 초대가 없습니다',
      noneYet: '아직 초대가 없습니다',
      noCode: '링크를 발급하기 전까지는 아무도 가입할 수 없습니다.',
      onlyCode: '지금은 위의 코드로만 가입할 수 있습니다.',
    },
    columns: {
      invitation: '초대',
      used: '사용',
      expires: '만료',
      state: '상태',
    },
    untitled: '제목 없음',
    byline: (prefix: string, by: string) => `${prefix}… · ${by} 발급`,
    uses: (uses: number, max: number | null) => (max === null ? `${uses}` : `${uses}/${max}`),
    never: '없음',
    states: {
      live: '사용 가능',
      usedUp: '소진됨',
      expired: '만료됨',
      withdrawn: '회수됨',
    },
    thisInvitation: '이 초대',
    withdraw: '회수',
    hideSpent: '유효하지 않은 초대 숨기기',
    showSpent: (count: number) => `유효하지 않은 초대 ${count}개 보기`,
    create: {
      title: '새 초대',
      label: '용도',
      labelHint: '나만 볼 수 있습니다. 링크를 구분하는 데 쓰입니다.',
      labelPlaceholder: '디자인 리뷰용',
      limit: '가입 인원',
      life: '유효 기간',
      submit: '링크 발급',
    },
    limits: {
      one: '1명',
      five: '최대 5명',
      twentyFive: '최대 25명',
      none: '제한 없음',
    },
    lives: {
      day: '1일',
      week: '1주',
      fortnight: '2주',
      threeMonths: '3개월',
      forever: '회수할 때까지',
    },
    issued: {
      title: '초대 링크',
      description:
        '지금 복사하세요. 해시만 저장되므로 다시 볼 수 없습니다. 잃어버렸다면 새로 발급하세요.',
      copy: '링크 복사',
    },
    remove: {
      title: '이 초대를 삭제할까요?',
      withAccounts: (count: number) =>
        `이 초대로 가입한 계정 ${count}개에서 가입 경로 기록이 사라집니다. 삭제 대신 회수하면 초대는 더 이상 쓸 수 없지만 기록은 남습니다.`,
      withoutAccounts:
        '초대가 더 이상 작동하지 않고 기록도 남지 않습니다. 삭제 대신 회수하면 기록은 남습니다.',
    },
  },
  people: {
    documentTitle: '사용자',
    columns: {
      account: '계정',
      holds: '보유',
      joined: '가입일',
      lastChange: '최근 변경',
    },
    owner: '소유자',
    suspended: '정지됨',
    via: (label: string) => `${quoted(label)} 초대로 가입`,
    viaInvitation: '초대로 가입',
    holds: (workspaces: number, plans: number, keys: number) =>
      [
        `워크스페이스 ${workspaces}개`,
        `플랜 ${plans}개`,
        ...(keys > 0 ? [`키 ${keys}개`] : []),
      ].join(' · '),
    withdrawOwnership: '소유자 권한 해제',
    makeOwner: '소유자로 지정',
    suspend: '정지',
    letBackIn: '정지 해제',
    you: '나',
    signedInAs: (who: ReactNode) => (
      <>
        {who} 계정으로 로그인되어 있습니다. 계정은 삭제하지 않고 정지하므로, 그 계정이 그린 내용의
        작성자 기록은 그대로 남습니다.
      </>
    ),
    suspendTitle: (name: string) => `${name} 님의 계정을 정지할까요?`,
    suspendDescription:
      '모든 기기에서 즉시 로그아웃되며 다시 로그인할 수 없습니다. 워크스페이스, 플랜, 기록은 그대로 남습니다.',
  },
  usage: {
    documentTitle: '사용량',
    openPlans: '열린 플랜',
    connections: '접속 수',
    rightNow: '현재',
    signedIn: '로그인 세션',
    activeIn: (active: number, days: number) => `${days}일간 활동 ${active}명`,
    accounts: '계정',
    newAndSuspended: (joined: number, suspended: number) =>
      `신규 ${joined}명 · 정지 ${suspended}명`,
    newIn: (joined: number, days: number) => `${days}일간 신규 ${joined}명`,
    drawn: {
      title: '작성된 내용',
      plans: '플랜',
      inTrash: (count: number) => `휴지통에 ${count}개`,
      nodes: '노드',
      nodesPerPlan: (count: number) => `플랜당 평균 ${count}개`,
      connections: '연결',
      largestPlan: '가장 큰 플랜',
      nodeCount: (count: number) => `노드 ${count}개`,
      workspaces: '워크스페이스',
      projectCount: (count: number) => `프로젝트 ${count}개`,
    },
    agents: {
      title: '에이전트',
      keysInUse: '사용 중인 키',
      revoked: (count: number) => `폐기 ${count}개`,
      changesByAgents: '에이전트가 한 변경',
      shareOfEverything: (percent: number) => `전체의 ${percent}%`,
      shareLinks: '공유 링크',
      invitationsOpen: '유효한 초대',
      database: '데이터베이스',
      lastUsed: '마지막 사용',
    },
    busiest: {
      title: '활동이 많은 워크스페이스',
      changeCount: (count: number) => `변경 ${count}건`,
      planCount: (count: number) => `플랜 ${count}개`,
    },
    trend: {
      title: (days: number) => `최근 ${days}일간 변경`,
      aside: (changes: number, days: number) => `최근 ${days}일 ${changes}건`,
      byAgents: (count: number) => `에이전트 ${count}건`,
      byPeople: (count: number) => `사람 ${count}건`,
      people: '사람',
      agents: '에이전트',
      peak: (count: number) => `최대 ${count}건`,
    },
  },
};
