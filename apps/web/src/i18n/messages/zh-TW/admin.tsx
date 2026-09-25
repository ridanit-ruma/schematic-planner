import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const admin: Messages['admin'] = {
  layout: {
    title: '站台管理',
    body: '與整個部署有關的一切，而不只是單一工作區。',
    tabUsage: '使用情形',
    tabInvitations: '邀請',
    tabPeople: '使用者',
  },
  actions: '操作',
  invitations: {
    documentTitle: '邀請',
    intro:
      '連結可以讓某人在這裡建立帳號。請一人給一個連結，而不是把同一組代碼發給所有人：連結可以設定限制、隨時撤回，事後也分辨得出是誰用的。',
    newLink: '新增連結',
    code: {
      title: '註冊代碼',
      body: (variable: ReactNode) => (
        <>
          設定在這個部署的組態中。任何持有代碼的人都能不透過連結建立帳號，次數不限，而且這裡不會留下任何紀錄。清除{' '}
          {variable} 即可關閉這個入口。
        </>
      ),
    },
    copied: '已複製',
    copy: '複製',
    empty: {
      noneOpen: '沒有仍然有效的邀請',
      noneYet: '還沒有邀請',
      noCode: '在你發出連結之前，沒有人能註冊。',
      onlyCode: '目前只能透過上方的代碼註冊。',
    },
    columns: {
      invitation: '邀請',
      used: '已使用',
      expires: '到期',
      state: '狀態',
    },
    untitled: '未命名',
    byline: (prefix: string, by: string) => `${prefix}… · 由 ${by} 發出`,
    uses: (uses: number, max: number | null) => (max === null ? `${uses}` : `${uses} / ${max}`),
    never: '永不',
    states: {
      live: '有效',
      usedUp: '已用完',
      expired: '已過期',
      withdrawn: '已撤回',
    },
    thisInvitation: '這個邀請',
    withdraw: '撤回',
    hideSpent: '隱藏已失效的邀請',
    showSpent: (count: number) => `顯示 ${count} 個已失效的邀請`,
    create: {
      title: '新增邀請',
      label: '用途',
      labelHint: '只有你看得到，用來分辨不同的連結。',
      labelPlaceholder: '設計審查用',
      limit: '可建立的帳號數',
      life: '有效期限',
      submit: '發出連結',
    },
    limits: {
      one: '一人',
      five: '最多五人',
      twentyFive: '最多二十五人',
      none: '不限',
    },
    lives: {
      day: '一天',
      week: '一週',
      fortnight: '兩週',
      threeMonths: '三個月',
      forever: '直到撤回',
    },
    issued: {
      title: '邀請連結',
      description: '請立即複製。系統只保存它的雜湊值，之後無法再次顯示；如果遺失，請重新發出一個。',
      copy: '複製連結',
    },
    remove: {
      title: '要刪除這個邀請嗎？',
      withAccounts: (count: number) =>
        `有 ${count} 個帳號是透過它加入的，刪除後將不再記錄這些帳號的來源。若改為撤回，連結會失效，但會保留這項紀錄。`,
      withoutAccounts: '連結會失效，且不留下任何紀錄。若改為撤回，則會保留紀錄。',
    },
  },
  people: {
    documentTitle: '使用者',
    columns: {
      account: '帳號',
      holds: '擁有',
      joined: '加入時間',
      lastChange: '最後變更',
    },
    owner: '擁有者',
    suspended: '已停權',
    via: (label: string) => `透過 ${label}`,
    viaInvitation: '透過邀請',
    holds: (workspaces: number, plans: number, keys: number) =>
      [`${workspaces} 個工作區`, `${plans} 個計畫`, ...(keys > 0 ? [`${keys} 組金鑰`] : [])].join(
        ' · ',
      ),
    withdrawOwnership: '撤除擁有者身分',
    makeOwner: '設為擁有者',
    suspend: '停權',
    letBackIn: '恢復存取',
    you: '你',
    signedInAs: (who: ReactNode) => (
      <>目前以 {who} 登入。帳號只會停權而不會刪除，這樣它繪製過的內容仍能歸屬到某個人。</>
    ),
    suspendTitle: (name: string) => `要將 ${name} 停權嗎？`,
    suspendDescription:
      '對方會立即在所有裝置上登出，且無法再次登入。其工作區、計畫與歷史紀錄都會維持原狀。',
  },
  usage: {
    documentTitle: '使用情形',
    openPlans: '開啟中的計畫',
    connections: '連線數',
    rightNow: '目前',
    signedIn: '已登入',
    activeIn: (active: number, days: number) => `${days} 天內有 ${active} 人活躍`,
    accounts: '帳號',
    newAndSuspended: (joined: number, suspended: number) => `新增 ${joined} · 停權 ${suspended}`,
    newIn: (joined: number, days: number) => `${days} 天內新增 ${joined}`,
    drawn: {
      title: '已繪製的內容',
      plans: '計畫',
      inTrash: (count: number) => `垃圾桶中有 ${count} 個`,
      nodes: '節點',
      nodesPerPlan: (count: number) => `平均每個計畫 ${count} 個`,
      connections: '連接',
      largestPlan: '最大的計畫',
      nodeCount: (count: number) => `${count} 個節點`,
      workspaces: '工作區',
      projectCount: (count: number) => `${count} 個專案`,
    },
    agents: {
      title: 'AI 代理',
      keysInUse: '使用中的金鑰',
      revoked: (count: number) => `${count} 組已撤銷`,
      changesByAgents: 'AI 代理做的變更',
      shareOfEverything: (percent: number) => `佔全部的 ${percent}%`,
      shareLinks: '分享連結',
      invitationsOpen: '有效的邀請',
      database: '資料庫',
      lastUsed: '最近使用',
    },
    busiest: {
      title: '最活躍的工作區',
      changeCount: (count: number) => `${count} 次變更`,
      planCount: (count: number) => `${count} 個計畫`,
    },
    trend: {
      title: (days: number) => `${days} 天內的變更`,
      aside: (changes: number, days: number) => `最近 ${days} 天共 ${changes} 次`,
      byAgents: (count: number) => `AI 代理 ${count} 次`,
      byPeople: (count: number) => `真人 ${count} 次`,
      people: '真人',
      agents: 'AI 代理',
      peak: (count: number) => `最高 ${count}`,
    },
  },
};
