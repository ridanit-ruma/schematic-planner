import type { Messages } from '../en';

export const editor: Messages['editor'] = {
  hint: '输入 / 插入块，或直接写 Markdown：# 标题、- 列表、[] 待办。智能体和导出按 Markdown 读取。',
  placeholder: '输入内容，或输入 / 插入块',
  summaryPlaceholder: '折叠块',
  label: '详情',
  slash: {
    label: '插入块',
    noMatch: '没有匹配的块',
  },
  blocks: {
    paragraph: '文本',
    heading1: '标题 1',
    heading2: '标题 2',
    heading3: '标题 3',
    bulletList: '项目符号列表',
    orderedList: '编号列表',
    taskList: '待办列表',
    quote: '引用',
    codeBlock: '代码',
    divider: '分隔线',
    table: '表格',
    toggle: '折叠块',
    callout: '标注',
  },
  callout: {
    type: '标注类型',
    title: '标题',
    variants: {
      note: '备注',
      tip: '提示',
      warning: '注意',
      danger: '危险',
    },
  },
  table: {
    addRow: '添加行',
    addColumn: '添加列',
    deleteRow: '删除行',
    deleteColumn: '删除列',
    deleteTable: '删除表格',
  },
  drag: '拖动以移动此块',
  raw: 'Markdown',
  rawHint: '编辑器没有对应这段 Markdown 的块，因此按原样保留。',
};
