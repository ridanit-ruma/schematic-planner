import type { ReactNode } from 'react';

import type { Messages } from '../en';
import { josa, quoted } from './josa';

export const workspaces: Messages['workspaces'] = {
  /** A role's display name. The enum value sent to the API stays as it is. */
  roles: {
    OWNER: '소유자',
    ADMIN: '관리자',
    EDITOR: '편집자',
    VIEWER: '뷰어',
  },
  /** The ruled index shared by the project, plan and folder screens. */
  list: {
    name: '이름',
    holds: '내용',
    updated: '수정일',
    actions: '관리',
    settings: '설정',
    moveToFolder: '폴더로 이동…',
    moveToTrash: '휴지통으로 이동',
    nodeCount: (n: number) => `노드 ${n}개`,
    planCount: (n: number) => `플랜 ${n}개`,
    confirmTrash: (name: string) => `${quoted(name, '을')} 휴지통으로 옮길까요?`,
    planTrashBody: '목록 어디에도 더 이상 표시되지 않습니다. 휴지통에서 복원할 수 있습니다.',
    folderTrashBody: '폴더 안의 플랜도 함께 이동하며, 복원하면 함께 돌아옵니다.',
    renameFolder: '폴더 이름 변경',
  },
  newPlan: {
    title: '새 플랜',
    titleLabel: '제목',
    titlePlaceholder: '정산 원장 이전',
    descriptionLabel: '설명',
    descriptionHint: '이 플랜이 무엇을 그리는지 한 줄로 적습니다. 목록에 표시됩니다.',
    descriptionPlaceholder: '청구서가 원장에서 PDF로 나오기까지의 흐름.',
    submit: '플랜 만들기',
    createFirst: '첫 플랜 만들기',
  },
  projects: {
    title: '프로젝트',
    description: (projects: number, workspace: string) =>
      projects === 0
        ? `${workspace}에 아직 프로젝트가 없습니다.`
        : `${workspace}에 프로젝트 ${projects}개가 있습니다.`,
    newProject: '새 프로젝트',
    empty: {
      title: '아직 프로젝트가 없습니다',
      body: '프로젝트는 만들고 있는 것 하나에 관한 플랜을 모아 둡니다. 대부분의 워크스페이스는 프로젝트 하나로 시작합니다.',
      action: '첫 프로젝트 만들기',
    },
    project: '프로젝트',
    plans: '플랜',
    trashBody: '안에 있는 플랜도 함께 이동합니다. 휴지통에서 프로젝트 전체를 복원할 수 있습니다.',
    create: {
      title: '새 프로젝트',
      nameLabel: '이름',
      nameHint: '주소는 이름을 바탕으로 만들어지며, 나중에 바뀌지 않습니다.',
      namePlaceholder: '결제 시스템 개편',
      descriptionLabel: '설명',
      descriptionHint: '이 프로젝트의 목적을 한 줄로 적습니다. 목록에 표시됩니다.',
      descriptionPlaceholder: '결제 기능을 모놀리스에서 분리합니다.',
      submit: '프로젝트 만들기',
    },
  },
  plans: {
    title: '플랜',
    description: (folders: number, plans: number) => {
      if (plans === 0) {
        return folders === 0
          ? '이 프로젝트에 아직 그린 플랜이 없습니다.'
          : `이 프로젝트에 폴더 ${folders}개가 있고, 아직 그린 플랜은 없습니다.`;
      }
      return `이 프로젝트에 ${folders === 0 ? '' : `폴더 ${folders}개, `}플랜 ${plans}개가 있습니다.`;
    },
    newFolder: '새 폴더',
    empty: {
      title: '아직 플랜이 없습니다',
      body: '여기에서 직접 그리거나, AI 에이전트를 이 워크스페이스에 연결해 첫 플랜을 맡겨 보세요.',
    },
    createFolder: {
      title: '새 폴더',
      nameLabel: '이름',
      nameHint: '프로젝트 안의 서랍 같은 공간입니다. 폴더 안에 폴더를 만들 수는 없습니다.',
      namePlaceholder: '아키텍처',
      submit: '폴더 만들기',
    },
  },
  folder: {
    title: '폴더',
    missing: {
      title: '폴더를 찾을 수 없습니다',
      body: '삭제되었거나 다른 프로젝트의 폴더일 수 있습니다.',
      back: (project: string) => `${josa(project, '으로')} 돌아가기`,
    },
    description: (plans: number) =>
      plans === 0 ? '이 폴더에는 아직 플랜이 없습니다.' : `이 폴더에 플랜 ${plans}개가 있습니다.`,
    moveFolderToTrash: '폴더를 휴지통으로 이동',
    empty: {
      title: '폴더가 비어 있습니다',
      body: '여기에 플랜을 그리거나, 프로젝트에서 플랜을 옮겨 오세요.',
    },
  },
  moveToFolder: {
    title: (plan: string) => `${quoted(plan)} 이동`,
    description: '이 프로젝트의 어느 폴더에 넣을지 고르세요.',
    folder: '폴더',
    topLevel: '최상위',
    topLevelHint: '어느 폴더에도 넣지 않음',
    submit: '이동',
  },
  projectSettings: {
    title: '프로젝트 설정',
    description: '이 프로젝트의 이름을 정하고, 필요 없으면 삭제합니다.',
    openPlans: '플랜 목록 열기',
    name: {
      title: '이름',
      body: '이름을 바꿔도 주소는 그대로 유지되므로, 누군가 저장해 둔 링크도 계속 작동합니다.',
      label: '프로젝트 이름',
      description: '설명',
    },
    delete: {
      title: '프로젝트 삭제',
      body: '프로젝트에 속한 플랜과 함께 휴지통으로 이동합니다. 복원하면 안에 있던 것이 그대로 돌아옵니다.',
    },
  },
  settings: {
    title: '워크스페이스 설정',
    name: {
      title: '이름',
      body: (slug: ReactNode) => (
        <>이름을 바꿔도 주소는 {slug} 그대로 유지되므로, 누군가 저장해 둔 링크도 계속 작동합니다.</>
      ),
      label: '워크스페이스 이름',
    },
    delete: {
      title: '워크스페이스 삭제',
      body: (workspace: string) =>
        `${workspace}의 모든 프로젝트, 플랜, API 키가 모든 멤버에게서 함께 삭제됩니다. 남겨 둘 것이 있다면 먼저 내보내세요. 내보낸 파일은 이 서비스 없이도 읽을 수 있습니다.`,
      action: '워크스페이스 삭제',
      confirmTitle: (workspace: string) => `${workspace} 삭제`,
      confirmBody: '되돌릴 수 없습니다. 확인을 위해 워크스페이스 이름을 입력하세요.',
      typeName: (workspace: string) => `"${workspace}" 입력`,
    },
  },
  members: {
    title: '멤버',
    description: (workspace: string) => `${workspace}에 접근할 수 있는 모든 사람입니다.`,
    invite: '초대하기',
    empty: {
      title: '멤버가 없습니다',
      body: '있을 수 없는 상태입니다. 워크스페이스에는 항상 소유자가 있어야 합니다.',
    },
    person: '멤버',
    role: '역할',
    you: '나',
    roleHelp: {
      VIEWER: '플랜을 보고 내보낼 수 있습니다.',
      EDITOR: '플랜을 그리고, 에이전트용 키를 만들 수 있습니다.',
      ADMIN: '편집자 권한에 더해, 사람을 초대하고 역할을 바꿀 수 있습니다.',
      OWNER: '관리자 권한에 더해, 워크스페이스를 삭제할 수 있습니다.',
    },
    invitations: {
      title: '대기 중인 초대',
      body: '아직 누군가 들어올 수 있는 링크입니다. 사용이 끝났거나 만료된 링크는 표시하지 않으며, 회수하면 즉시 작동을 멈춥니다.',
      link: '링크',
      role: '역할',
      expires: '만료',
      issuedEarlier: '이전에 발급됨',
      by: (name: string) => `${name} 발급`,
      withdraw: '회수',
    },
    inviteModal: {
      title: '초대하기',
      description:
        '링크를 만듭니다. 링크를 연 사람은 누구나 선택한 역할로 이 워크스페이스에 참여합니다.',
      role: '역할',
      submit: '링크 만들기',
      expiry: '링크는 14일 뒤 만료됩니다. 아직 이메일 발송 기능이 없으니 직접 전달하세요.',
      copy: '복사',
    },
  },
  invite: {
    documentTitle: '초대',
    invitedYou: (inviter: ReactNode) => <>{inviter} 님이 다음 워크스페이스에 초대했습니다</>,
    asRole: {
      OWNER: (role: ReactNode) => (
        <>{role} 역할로 참여하며, 워크스페이스 삭제를 포함해 모든 것을 관리할 수 있습니다.</>
      ),
      ADMIN: (role: ReactNode) => (
        <>{role} 역할로 참여하며, 멤버와 프로젝트를 관리할 수 있습니다.</>
      ),
      EDITOR: (role: ReactNode) => <>{role} 역할로 참여하며, 모든 플랜을 그릴 수 있습니다.</>,
      VIEWER: (role: ReactNode) => <>{role} 역할로 참여하며, 모든 플랜을 볼 수 있습니다.</>,
      other: (role: ReactNode) => <>{role} 역할로 참여합니다.</>,
    },
    settled: {
      accepted: (inviter: string) =>
        `이미 사용된 초대입니다. ${inviter} 님에게 새 초대를 요청하세요.`,
      declined: (inviter: string) => `거절된 초대입니다. ${inviter} 님에게 새 초대를 요청하세요.`,
      expired: (inviter: string) => `만료된 초대입니다. ${inviter} 님에게 새 초대를 요청하세요.`,
    },
    alreadyMember: '이미 이 워크스페이스의 멤버입니다.',
    open: (workspace: string) => `${workspace} 열기`,
    signInToAccept: '로그인하고 수락',
    createAccount: '계정 만들기',
    otherAddress: (invited: ReactNode, signedIn: ReactNode) => (
      <>
        이 초대는 {invited} 앞으로 보낸 것이지만, 지금은 {signedIn} 계정으로 로그인되어 있습니다.
        수락하면 지금 로그인한 계정으로 참여합니다.
      </>
    ),
    accept: '수락',
    decline: '거절',
    signedInAs: (email: string) => `${email} 계정으로 로그인됨`,
  },
  trash: {
    title: '휴지통',
    description:
      '삭제한 플랜과 프로젝트가 여기에 보관됩니다. 저절로 사라지지 않으니, 복원하거나 완전히 삭제하세요.',
    emptyTrash: '휴지통 비우기',
    empty: {
      title: '휴지통이 비어 있습니다',
      body: '삭제한 플랜과 프로젝트는 바로 사라지지 않고 여기에 표시됩니다.',
    },
    item: '항목',
    wasIn: '원래 위치',
    deleted: '삭제일',
    kinds: {
      plan: '플랜',
      project: '프로젝트',
      folder: '폴더',
    },
    shared: '공유 중',
    by: (name: string) => `${name} 삭제`,
    restore: '복원',
    stopSharing: '공유 중지',
    deleteForGood: '완전히 삭제',
    purge: {
      title: (name: string) => `${quoted(name, '을')} 완전히 삭제할까요?`,
      project: '프로젝트와 그 안의 모든 플랜이 함께 삭제됩니다. 되돌릴 수 없습니다.',
      folder: '폴더만 삭제되고, 안에 있던 플랜은 프로젝트 최상위로 돌아갑니다. 되돌릴 수 없습니다.',
      plan: '플랜과 기록, 공유 링크가 함께 삭제됩니다. 되돌릴 수 없습니다.',
    },
    emptyModal: {
      title: '휴지통을 비울까요?',
      body: (items: number) => `항목 ${items}개가 완전히 삭제됩니다. 되돌릴 수 없습니다.`,
    },
  },
};
