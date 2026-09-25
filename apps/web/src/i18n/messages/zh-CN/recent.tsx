import type { Messages } from '../en';

export const recent: Messages['recent'] = {
  title: '最近',
  description: '你在所属的所有工作区中最近处理过的内容。',
  empty: {
    title: '还没有画任何东西',
    body: '你打开过的计划，以及智能体修改过的计划，会按时间从新到旧显示在这里。',
  },
  columns: {
    plan: '计划',
    where: '位置',
    lastTouchedBy: '最后修改者',
    updated: '更新时间',
  },
  untitledPlan: '未命名计划',
  firstWorkspace: {
    title: '还没有工作区',
    body: '工作区用来存放你的项目，以及智能体连接时使用的密钥。',
    create: '创建工作区',
    modalTitle: '新建工作区',
    name: '名称',
    placeholder: '示例科技',
    submit: '创建工作区',
  },
};
