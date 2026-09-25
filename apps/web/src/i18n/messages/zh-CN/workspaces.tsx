import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const workspaces: Messages['workspaces'] = {
  roles: {
    OWNER: '所有者',
    ADMIN: '管理员',
    EDITOR: '编辑者',
    VIEWER: '查看者',
  },
  list: {
    actions: '操作',
    moveToTrash: '移到回收站',
    confirmTrash: (name: string) => `将“${name}”移到回收站？`,
  },
  projects: {
    trashBody: '其中的计划会一起移走。你可以从回收站恢复整个项目。',
  },
  projectSettings: {
    title: '项目设置',
    description: '这个项目的名称，以及如何处置它。',
    name: {
      title: '名称',
      body: '地址保持不变，这样即使改了名，别人保存的链接也依然有效。',
      label: '项目名称',
      description: '描述',
    },
    delete: {
      title: '删除此项目',
      body: '它会连同其中的计划一起移到回收站，恢复时会原样还原其中的所有内容。',
    },
  },
  settings: {
    title: '工作区设置',
    name: {
      title: '名称',
      body: (slug: ReactNode) => <>地址始终是 {slug}，这样即使改了名，别人保存的链接也依然有效。</>,
      label: '工作区名称',
    },
    delete: {
      title: '删除此工作区',
      body: (workspace: string) =>
        `${workspace} 中的所有项目、计划和 API 密钥都会随之删除，对所有人生效。请先导出你想保留的内容，导出的文件无需依赖本服务即可阅读。`,
      action: '删除工作区',
      confirmTitle: (workspace: string) => `删除 ${workspace}`,
      confirmBody: '此操作无法撤销。请输入工作区名称以确认。',
      typeName: (workspace: string) => `输入“${workspace}”`,
    },
  },
  members: {
    title: '成员',
    description: (workspace: string) => `所有可以打开 ${workspace} 的人。`,
    invite: '邀请成员',
    empty: {
      title: '这里没有人',
      body: '这本不应该发生，工作区总会保留一个所有者。',
    },
    person: '成员',
    role: '角色',
    you: '你',
    roleHelp: {
      VIEWER: '可以查看和导出计划。',
      EDITOR: '可以绘制计划，也可以为智能体创建密钥。',
      ADMIN: '还可以邀请成员和更改角色。',
      OWNER: '还可以删除工作区。',
    },
    invitations: {
      title: '有效邀请',
      body: '仍可让人加入的链接。已用完或已过期的链接不会列出；撤回后链接立即失效。',
      link: '链接',
      role: '角色',
      expires: '到期时间',
      issuedEarlier: '早先生成',
      by: (name: string) => `由 ${name} 创建`,
      withdraw: '撤回',
    },
    inviteModal: {
      title: '邀请成员',
      description: '生成一个链接。任何打开它的人都会以你选择的角色加入此工作区。',
      role: '角色',
      submit: '生成链接',
      expiry: '链接将在 14 天后过期。目前还不支持发送邮件，请自行把链接发给对方。',
      copy: '复制',
    },
  },
  invite: {
    documentTitle: '邀请',
    invitedYou: (inviter: ReactNode) => <>{inviter} 邀请你加入</>,
    asRole: {
      OWNER: (role: ReactNode) => <>角色为{role}，你可以管理整个工作区，包括删除它。</>,
      ADMIN: (role: ReactNode) => <>角色为{role}，你可以管理成员和项目。</>,
      EDITOR: (role: ReactNode) => <>角色为{role}，你可以编辑其中的所有计划。</>,
      VIEWER: (role: ReactNode) => <>角色为{role}，你可以查看其中的所有计划。</>,
      other: (role: ReactNode) => <>角色为{role}，你可以参与其中。</>,
    },
    settled: {
      accepted: (inviter: string) => `此邀请已被使用。请向 ${inviter} 索取新的邀请。`,
      declined: (inviter: string) => `此邀请已被拒绝。请向 ${inviter} 索取新的邀请。`,
      expired: (inviter: string) => `此邀请已过期。请向 ${inviter} 索取新的邀请。`,
    },
    alreadyMember: '你已经是此工作区的成员。',
    open: (workspace: string) => `打开 ${workspace}`,
    signInToAccept: '登录后接受',
    createAccount: '创建账号',
    otherAddress: (invited: ReactNode, signedIn: ReactNode) => (
      <>
        此邀请发送给了 {invited}，而你当前登录的是 {signedIn}。接受后，加入的将是你当前登录的账号。
      </>
    ),
    accept: '接受',
    decline: '拒绝',
    signedInAs: (email: string) => `当前登录：${email}`,
  },
  trash: {
    title: '回收站',
    description: '已删除的计划和项目会保留在这里，不会自动清除。你可以恢复它们，或将其永久删除。',
    emptyTrash: '清空回收站',
    empty: {
      title: '回收站是空的',
      body: '删除的计划和项目会出现在这里，而不是直接消失。',
    },
    item: '条目',
    wasIn: '原位置',
    deleted: '删除时间',
    kinds: {
      plan: '计划',
      project: '项目',
      folder: '文件夹',
    },
    shared: '已分享',
    by: (name: string) => `由 ${name} 删除`,
    restore: '恢复',
    stopSharing: '停止分享',
    deleteForGood: '永久删除',
    purge: {
      title: (name: string) => `永久删除“${name}”？`,
      project: '此项目及其中的所有计划都会被删除。此操作无法撤销。',
      folder: '文件夹会被删除，其中的计划会回到项目顶层。此操作无法撤销。',
      plan: '此计划、它的历史记录和分享链接都会被删除。此操作无法撤销。',
    },
    emptyModal: {
      title: '清空回收站？',
      body: (items: number) => `${items} 个条目将被永久删除。此操作无法撤销。`,
    },
  },
};
