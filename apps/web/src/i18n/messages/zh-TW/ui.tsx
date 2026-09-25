import type { Messages } from '../en';

export const ui: Messages['ui'] = {
  author: {
    someone: '某人',
    via: (name: string) => ` · 透過 ${name}`,
  },
  markdown: {
    task: '待辦事項',
  },
  rowMenu: {
    actionsFor: (label: string) => `${label} 的操作`,
  },
  notFound: {
    title: {
      page: '找不到這個頁面',
      plan: '找不到這個計畫',
      sharedPlan: '找不到這個分享的計畫',
      project: '找不到這個專案',
      folder: '找不到這個資料夾',
      workspace: '找不到這個工作區',
    },
    body: '這個網址無法通往任何你能存取的地方。它可能從未存在、已被刪除，或屬於尚未與你分享的人。',
    back: '回到剛才的工作',
  },
  api: {
    unreachable: (url: string) =>
      `無法連線到位於 ${url} 的伺服器。伺服器可能已離線，或目前的網址不被允許呼叫它。`,
  },
};
