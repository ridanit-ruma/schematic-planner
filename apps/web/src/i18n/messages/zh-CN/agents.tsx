import type { Messages } from '../en';

export const agents: Messages['agents'] = {
  documentTitle: '智能体',
  intro:
    '连接 Cursor、Claude 或其他任何 MCP 客户端。密钥属于你本人，而不属于某个工作区，因此一个密钥就能访问你加入的所有工作区。智能体可以读取你的计划，并在你正在查看的同一块画布上绘制新计划。',
  server: {
    title: '服务器 URL',
    body: '此实例上所有人都相同。与下方的密钥配合使用。',
  },
  keys: {
    title: '密钥',
    body: '密钥代表你本人，在你加入的所有工作区中都有效。撤销后立即失效。',
    newKey: '新建密钥',
    empty: {
      title: '还没有密钥',
      body: '创建一个密钥，连接你的第一个智能体。',
    },
    columns: {
      name: '名称',
      key: '密钥',
      lastUsed: '上次使用',
      actions: '操作',
    },
    neverUsed: '从未使用',
    never: '从未',
    limitedTo: (scope: string) => `仅限 ${scope}`,
    revoke: '撤销',
  },
  create: {
    title: '新建密钥',
    name: '名称',
    nameHint: '写明它在哪台机器或哪个工具上使用。',
    namePlaceholder: '我笔记本上的 Cursor',
    submit: '创建密钥',
  },
  issued: {
    title: '请立即复制密钥',
    description: '密钥只会显示这一次。服务器只保存它的哈希值，不保存密钥本身。',
    configTitle: 'MCP 客户端配置',
    configBody: '将其粘贴到客户端的 MCP 设置中。复制这段配置就完成了全部设置，无需安装任何东西。',
  },
  copyConfiguration: '复制配置',
  copy: '复制',
};
