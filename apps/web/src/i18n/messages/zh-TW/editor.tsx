import type { Messages } from '../en';

export const editor: Messages['editor'] = {
  hint: '輸入 / 插入區塊，或直接寫 Markdown：# 標題、- 清單、[] 待辦事項。AI 代理和匯出會以 Markdown 讀取。',
  placeholder: '輸入內容，或輸入 / 插入區塊',
  summaryPlaceholder: '摺疊區塊',
  label: '詳細內容',
  slash: {
    label: '插入區塊',
    noMatch: '沒有符合的區塊',
  },
  blocks: {
    paragraph: '文字',
    heading1: '標題 1',
    heading2: '標題 2',
    heading3: '標題 3',
    bulletList: '項目符號清單',
    orderedList: '編號清單',
    taskList: '待辦清單',
    quote: '引言',
    codeBlock: '程式碼',
    divider: '分隔線',
    table: '表格',
    toggle: '摺疊區塊',
    callout: '提示框',
  },
  callout: {
    type: '提示框類型',
    title: '標題',
    variants: {
      note: '備註',
      tip: '提示',
      warning: '注意',
      danger: '危險',
    },
  },
  table: {
    addRow: '新增列',
    addColumn: '新增欄',
    deleteRow: '刪除列',
    deleteColumn: '刪除欄',
    deleteTable: '刪除表格',
  },
  drag: '拖曳以移動此區塊',
  raw: 'Markdown',
  rawHint: '編輯器沒有對應這段 Markdown 的區塊，因此照原樣保留。',
};
