import type { Messages } from '../en';

export const recent: Messages['recent'] = {
  title: '最近',
  description: '你在所屬的各個工作區中最近處理的內容。',
  empty: {
    title: '還沒有繪製任何東西',
    body: '你開啟過的計畫，或 AI 代理變更過的計畫，都會顯示在這裡，最新的排在最前面。',
    open: (workspace: string) => `開啟 ${workspace}`,
  },
  columns: {
    plan: '計畫',
    where: '位置',
    lastTouchedBy: '最後編輯者',
    updated: '更新時間',
  },
  untitledPlan: '未命名計畫',
  firstWorkspace: {
    title: '還沒有工作區',
    body: '工作區存放你的專案，以及 AI 代理連線時使用的金鑰。',
    create: '建立工作區',
    modalTitle: '新增工作區',
    name: '名稱',
    placeholder: '晨光工作室',
    submit: '建立工作區',
  },
};
