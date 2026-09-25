import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const admin: Messages['admin'] = {
  layout: {
    title: '实例',
    body: '与整个部署有关的一切，而不只是某一个工作区。',
    tabUsage: '用量',
    tabInvitations: '邀请',
    tabPeople: '用户',
  },
  actions: '操作',
  invitations: {
    documentTitle: '邀请',
    intro:
      '通过链接，别人可以在这里创建账号。请给每个人单独发一个链接，而不是把一个注册码发给所有人：链接可以限制次数、随时撤回，事后也能分清谁是通过哪个链接来的。',
    newLink: '新建链接',
    code: {
      title: '注册码',
      body: (variable: ReactNode) => (
        <>
          在此部署的配置中设置。任何知道它的人都能不经链接创建账号，次数不限，而且这里不会留下任何记录。清空{' '}
          {variable} 即可关闭这个入口。
        </>
      ),
    },
    copied: '已复制',
    copy: '复制',
    empty: {
      noneOpen: '没有仍然有效的邀请',
      noneYet: '还没有邀请',
      noCode: '在你发出链接之前，没有人能注册。',
      onlyCode: '目前只能通过上面的注册码加入。',
    },
    columns: {
      invitation: '邀请',
      used: '已使用',
      expires: '到期时间',
      state: '状态',
    },
    untitled: '未命名',
    byline: (prefix: string, by: string) => `${prefix}… · 由 ${by} 创建`,
    uses: (uses: number, max: number | null) => (max === null ? `${uses}` : `${uses} / ${max}`),
    never: '永不',
    states: {
      live: '有效',
      usedUp: '已用完',
      expired: '已过期',
      withdrawn: '已撤回',
    },
    thisInvitation: '此邀请',
    withdraw: '撤回',
    hideSpent: '隐藏已失效的邀请',
    showSpent: (count: number) => `显示 ${count} 个已失效的邀请`,
    create: {
      title: '新建邀请',
      label: '用途',
      labelHint: '只有你能看到，用来区分不同的链接。',
      labelPlaceholder: '用于设计评审',
      limit: '可注册账号数',
      life: '有效期',
      submit: '生成链接',
    },
    limits: {
      one: '1 人',
      five: '最多 5 人',
      twentyFive: '最多 25 人',
      none: '不限',
    },
    lives: {
      day: '1 天',
      week: '1 周',
      fortnight: '2 周',
      threeMonths: '3 个月',
      forever: '直到撤回',
    },
    issued: {
      title: '邀请链接',
      description: '请立即复制。系统只保存它的哈希值，因此无法再次显示；如果丢失，请重新生成一个。',
      copy: '复制链接',
    },
    remove: {
      title: '删除此邀请？',
      withAccounts: (count: number) =>
        `有 ${count} 个账号是通过它注册的，删除后将不再显示它们的来源。改为撤回可以让它失效，同时保留这些记录。`,
      withoutAccounts: '它将失效并被彻底清除。改为撤回则会保留记录。',
    },
  },
  people: {
    documentTitle: '用户',
    columns: {
      account: '账号',
      holds: '拥有',
      joined: '加入时间',
      lastChange: '最近修改',
    },
    owner: '所有者',
    suspended: '已停用',
    via: (label: string) => `通过“${label}”`,
    viaInvitation: '通过邀请',
    holds: (workspaces: number, plans: number, keys: number) =>
      [`${workspaces} 个工作区`, `${plans} 个计划`, ...(keys > 0 ? [`${keys} 个密钥`] : [])].join(
        ' · ',
      ),
    withdrawOwnership: '取消所有者身份',
    makeOwner: '设为所有者',
    suspend: '停用',
    letBackIn: '恢复访问',
    you: '你',
    signedInAs: (who: ReactNode) => (
      <>当前登录身份：{who}。账号只会被停用而不会被删除，这样它画过的内容仍然能归属到具体的人。</>
    ),
    suspendTitle: (name: string) => `停用 ${name}？`,
    suspendDescription:
      '对方会立即在所有设备上退出登录，并且无法再次登录。其工作区、计划和历史记录都会原样保留。',
  },
  usage: {
    documentTitle: '用量',
    openPlans: '打开中的计划',
    connections: '在线连接',
    rightNow: '当前',
    signedIn: '已登录',
    activeIn: (active: number, days: number) => `${days} 天内活跃 ${active} 人`,
    accounts: '账号',
    newAndSuspended: (joined: number, suspended: number) => `新增 ${joined} · 停用 ${suspended}`,
    newIn: (joined: number, days: number) => `${days} 天内新增 ${joined}`,
    drawn: {
      title: '绘制内容',
      plans: '计划',
      inTrash: (count: number) => `回收站中 ${count} 个`,
      nodes: '节点',
      nodesPerPlan: (count: number) => `平均每个计划 ${count} 个`,
      connections: '连接',
      largestPlan: '最大的计划',
      nodeCount: (count: number) => `${count} 个节点`,
      workspaces: '工作区',
      projectCount: (count: number) => `${count} 个项目`,
    },
    agents: {
      title: '智能体',
      keysInUse: '使用中的密钥',
      revoked: (count: number) => `已撤销 ${count} 个`,
      changesByAgents: '智能体所做的修改',
      shareOfEverything: (percent: number) => `占全部的 ${percent}%`,
      shareLinks: '分享链接',
      invitationsOpen: '有效邀请',
      database: '数据库',
      lastUsed: '最近使用',
    },
    busiest: {
      title: '最活跃的工作区',
      changeCount: (count: number) => `${count} 次修改`,
      planCount: (count: number) => `${count} 个计划`,
    },
    trend: {
      title: (days: number) => `近 ${days} 天的修改`,
      aside: (changes: number, days: number) => `近 ${days} 天共 ${changes} 次`,
      byAgents: (count: number) => `智能体 ${count} 次`,
      byPeople: (count: number) => `人工 ${count} 次`,
      people: '人工',
      agents: '智能体',
      peak: (count: number) => `峰值 ${count}`,
    },
  },
};
