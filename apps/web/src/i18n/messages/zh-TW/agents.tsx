import type { Messages } from '../en';

export const agents: Messages['agents'] = {
  documentTitle: 'AI 代理',
  intro:
    '連接 Cursor、Claude 或任何其他 MCP 用戶端。金鑰屬於你本人，而不是單一工作區，因此一組金鑰就能存取你所屬的每個工作區。AI 代理可以讀取你的計畫，並在你正在看的同一張畫布上繪製新的計畫。',
  server: {
    title: '伺服器 URL',
    body: '這個站台上的每個人都相同。請搭配下方的金鑰使用。',
  },
  keys: {
    title: '金鑰',
    body: '金鑰會在你身為成員的所有地方代表你本人。撤銷後會立即失效。',
    newKey: '新增金鑰',
    empty: {
      title: '還沒有金鑰',
      body: '建立一組金鑰，連接你的第一個 AI 代理。',
    },
    columns: {
      name: '名稱',
      key: '金鑰',
      lastUsed: '上次使用',
      actions: '操作',
    },
    neverUsed: '從未使用',
    never: '從未',
    limitedTo: (scope: string) => `僅限 ${scope}`,
    revoke: '撤銷',
  },
  create: {
    title: '新增金鑰',
    name: '名稱',
    nameHint: '寫下是哪台電腦或哪個工具在使用它。',
    namePlaceholder: '我筆電上的 Cursor',
    submit: '建立金鑰',
  },
  issued: {
    title: '請立即複製金鑰',
    description: '金鑰只會顯示這一次。伺服器只保存雜湊值，不保存金鑰本身。',
    configTitle: 'MCP 用戶端設定',
    configBody: '貼到用戶端的 MCP 設定中。複製這段內容就完成所有設定，不需要安裝任何東西。',
  },
  copyConfiguration: '複製設定',
  copy: '複製',
};
