import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const workspaces: Messages['workspaces'] = {
  /** A role's display name. The enum value sent to the API stays as it is. */
  roles: {
    OWNER: '擁有者',
    ADMIN: '管理員',
    EDITOR: '編輯者',
    VIEWER: '檢視者',
  },
  /** The ruled index shared by the project, plan and folder screens. */
  list: {
    name: '名稱',
    holds: '內容',
    updated: '更新時間',
    actions: '操作',
    settings: '設定',
    moveToFolder: '移到資料夾…',
    moveToTrash: '移到垃圾桶',
    nodeCount: (n: number) => `${n} 個節點`,
    planCount: (n: number) => `${n} 個計畫`,
    confirmTrash: (name: string) => `要將 ${name} 移到垃圾桶嗎？`,
    planTrashBody: '它將不再出現在任何列出它的地方。你可以從垃圾桶還原。',
    folderTrashBody: '裡面的計畫會跟著一起移過去，還原時也會一起回來。',
    renameFolder: '重新命名資料夾',
  },
  newPlan: {
    title: '新增計畫',
    titleLabel: '標題',
    titlePlaceholder: '帳務系統遷移',
    descriptionLabel: '說明',
    descriptionHint: '這個計畫描繪的內容。一行文字，顯示在清單中。',
    descriptionPlaceholder: '發票如何從帳務系統產生成 PDF。',
    submit: '建立計畫',
    createFirst: '建立第一個計畫',
  },
  projects: {
    title: '專案',
    description: (projects: number, workspace: string) =>
      projects === 0 ? `${workspace} 裡還沒有任何專案。` : `${workspace} 裡有 ${projects} 個專案。`,
    newProject: '新增專案',
    empty: {
      title: '還沒有專案',
      body: '專案用來收納同一項開發工作的各個計畫。多數工作區都從一個專案開始。',
      action: '建立第一個專案',
    },
    project: '專案',
    plans: '計畫',
    trashBody: '裡面的計畫會跟著一起移過去。你可以從垃圾桶還原整個專案。',
    create: {
      title: '新增專案',
      nameLabel: '名稱',
      nameHint: '網址會依名稱產生，之後不會變更。',
      namePlaceholder: '帳單系統改版',
      descriptionLabel: '說明',
      descriptionHint: '這個專案的用途。一行文字，顯示在清單中。',
      descriptionPlaceholder: '把帳單功能從單體架構中拆分出來。',
      submit: '建立專案',
    },
  },
  plans: {
    title: '計畫',
    description: (folders: number, plans: number) =>
      plans === 0
        ? folders === 0
          ? '這個專案還沒有繪製任何計畫。'
          : `這個專案有 ${folders} 個資料夾，還沒有繪製任何計畫。`
        : folders === 0
          ? `這個專案有 ${plans} 個計畫。`
          : `這個專案有 ${folders} 個資料夾、${plans} 個計畫。`,
    newFolder: '新增資料夾',
    empty: {
      title: '還沒有計畫',
      body: '在這裡繪製一個，或讓 AI 代理連上這個工作區，由它為你建立第一個計畫。',
    },
    createFolder: {
      title: '新增資料夾',
      nameLabel: '名稱',
      nameHint: '用來整理這個專案裡的計畫。資料夾裡不能再放資料夾。',
      namePlaceholder: '系統架構',
      submit: '建立資料夾',
    },
  },
  folder: {
    title: '資料夾',
    missing: {
      title: '找不到這個資料夾',
      body: '它可能已被移到垃圾桶，或屬於其他專案。',
      back: (project: string) => `返回 ${project}`,
    },
    description: (plans: number) =>
      plans === 0 ? '這個資料夾還沒有任何計畫。' : `這個資料夾有 ${plans} 個計畫。`,
    moveFolderToTrash: '將資料夾移到垃圾桶',
    empty: {
      title: '這個資料夾是空的',
      body: '在這裡繪製計畫，或從專案中移入計畫。',
    },
  },
  moveToFolder: {
    title: (plan: string) => `移動 ${plan}`,
    description: '要把它放進這個專案的哪個資料夾。',
    folder: '資料夾',
    topLevel: '最上層',
    topLevelHint: '不在任何資料夾中',
    submit: '移動',
  },
  projectSettings: {
    title: '專案設定',
    description: '這個專案的名稱，以及如何處置它。',
    openPlans: '開啟計畫清單',
    name: {
      title: '名稱',
      body: '網址會維持不變，別人存下的連結不該因為改名而失效。',
      label: '專案名稱',
      description: '說明',
    },
    delete: {
      title: '刪除這個專案',
      body: '專案會連同其中的計畫一起移到垃圾桶，還原時會完整恢復原本的內容。',
    },
  },
  settings: {
    title: '工作區設定',
    name: {
      title: '名稱',
      body: (slug: ReactNode) => <>網址會維持為 {slug}，別人存下的連結不該因為改名而失效。</>,
      label: '工作區名稱',
    },
    delete: {
      title: '刪除這個工作區',
      body: (workspace: string) =>
        `${workspace} 中的所有專案、計畫與 API 金鑰都會一併刪除，所有人都無法再使用。請先匯出想保留的內容；匯出的檔案不需要依賴本服務就能閱讀。`,
      action: '刪除工作區',
      confirmTitle: (workspace: string) => `刪除 ${workspace}`,
      confirmBody: '此操作無法復原。請輸入工作區名稱以確認。',
      typeName: (workspace: string) => `輸入「${workspace}」`,
    },
  },
  members: {
    title: '成員',
    description: (workspace: string) => `所有可以開啟 ${workspace} 的人。`,
    invite: '邀請成員',
    empty: {
      title: '這裡沒有人',
      body: '這不應該發生，工作區一定會有擁有者。',
    },
    person: '成員',
    role: '角色',
    you: '你',
    roleHelp: {
      VIEWER: '可以閱讀及匯出計畫。',
      EDITOR: '可以繪製，也可以為 AI 代理建立金鑰。',
      ADMIN: '還可以邀請成員及變更角色。',
      OWNER: '還可以刪除工作區。',
    },
    invitations: {
      title: '有效的邀請',
      body: '仍可讓人加入的連結。已用完或已過期的不會列出；撤回後會立即失效。',
      link: '連結',
      role: '角色',
      expires: '到期',
      issuedEarlier: '先前發出',
      by: (name: string) => `由 ${name} 發出`,
      withdraw: '撤回',
    },
    inviteModal: {
      title: '邀請成員',
      description: '產生一個連結。開啟連結的人都會以你選擇的角色加入這個工作區。',
      role: '角色',
      submit: '產生連結',
      expiry: '連結將在 14 天後失效。目前還沒有寄信功能，請自行傳送。',
      copy: '複製',
    },
  },
  invite: {
    documentTitle: '邀請',
    invitedYou: (inviter: ReactNode) => <>{inviter} 邀請你加入</>,
    asRole: {
      OWNER: (role: ReactNode) => <>以{role}身分加入，可以管理整個工作區，包括將它刪除。</>,
      ADMIN: (role: ReactNode) => <>以{role}身分加入，可以管理成員與專案。</>,
      EDITOR: (role: ReactNode) => <>以{role}身分加入，可以在其中的每個計畫上繪製。</>,
      VIEWER: (role: ReactNode) => <>以{role}身分加入，可以閱讀其中的每個計畫。</>,
      other: (role: ReactNode) => <>以{role}身分加入，參與其中的工作。</>,
    },
    settled: {
      accepted: (inviter: string) => `這個邀請已經使用過了。請向 ${inviter} 索取新的邀請。`,
      declined: (inviter: string) => `這個邀請已被拒絕。請向 ${inviter} 索取新的邀請。`,
      expired: (inviter: string) => `這個邀請已過期。請向 ${inviter} 索取新的邀請。`,
    },
    alreadyMember: '你已經是這個工作區的成員。',
    open: (workspace: string) => `開啟 ${workspace}`,
    signInToAccept: '登入以接受邀請',
    createAccount: '建立帳號',
    otherAddress: (invited: ReactNode, signedIn: ReactNode) => (
      <>
        這個邀請是寄給 {invited} 的，但你目前以 {signedIn} 登入。接受後，將由你目前登入的帳號加入。
      </>
    ),
    accept: '接受',
    decline: '拒絕',
    signedInAs: (email: string) => `目前以 ${email} 登入`,
  },
  trash: {
    title: '垃圾桶',
    description: '刪除的計畫與專案會暫存在這裡。它們不會自行消失，你可以還原，或永久刪除。',
    emptyTrash: '清空垃圾桶',
    empty: {
      title: '垃圾桶是空的',
      body: '刪除的計畫與專案會出現在這裡，而不是直接消失。',
    },
    item: '項目',
    wasIn: '原位置',
    deleted: '刪除時間',
    kinds: {
      plan: '計畫',
      project: '專案',
      folder: '資料夾',
    },
    shared: '已分享',
    by: (name: string) => `由 ${name} 刪除`,
    restore: '還原',
    stopSharing: '停止分享',
    deleteForGood: '永久刪除',
    purge: {
      title: (name: string) => `要永久刪除 ${name} 嗎？`,
      project: '專案及其中的所有計畫都會一併刪除。此操作無法復原。',
      folder: '資料夾會被刪除，其中的計畫會回到專案的最上層。此操作無法復原。',
      plan: '計畫、它的歷史紀錄與分享連結都會一併刪除。此操作無法復原。',
    },
    emptyModal: {
      title: '要清空垃圾桶嗎？',
      body: (items: number) => `${items} 個項目將被永久刪除。此操作無法復原。`,
    },
  },
};
