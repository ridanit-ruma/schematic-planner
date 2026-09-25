import type { Messages } from '../en';

export const ui: Messages['ui'] = {
  author: {
    someone: '某人',
    via: (name: string) => ` · 通过 ${name}`,
  },
  markdown: {
    task: '任务',
  },
  rowMenu: {
    actionsFor: (label: string) => `“${label}”的操作`,
  },
  notFound: {
    title: {
      page: '此页面不存在',
      plan: '此计划不存在',
      sharedPlan: '此共享计划不存在',
      project: '此项目不存在',
      folder: '此文件夹不存在',
      workspace: '此工作区不存在',
    },
    body: '这个地址没有指向任何你可以访问的内容。它可能从未存在，可能已被删除，也可能属于尚未与你共享的人。',
    back: '回到刚才的工作',
  },
  api: {
    unreachable: (url: string) =>
      `无法连接到服务器 ${url}。服务器可能已离线，或者当前地址不允许调用它。`,
  },
};
