import type { Messages } from '../en';

export const canvas: Messages['canvas'] = {
  canvas: {
    menu: {
      addNode: '在此添加节点',
      tidyUp: '整理间距',
      duplicate: '创建副本',
      noteOnNode: '评论此节点',
      noteHere: '在此添加评论',
      groupNodes: (count: number) => `将 ${count} 个节点编为分组`,
      takeOutOf: (box: string) => `移出“${box}”`,
      takeOutOfBox: '移出分组',
      standardWidth: '使用标准宽度',
      deleteNode: '删除节点',
      deleteConnection: '删除连接',
      undo: '撤销',
      redo: '重做',
      fitPlan: '显示整个计划',
      gridSpacing: '网格间距',
      gridStep: (step: number) => `${step} px`,
      snapBy: '吸附基准',
      snapTerminals: '连接点',
      snapOuterEdge: '外边缘',
      hideResolved: (count: number) => `隐藏 ${count} 条已解决的评论`,
      showResolved: (count: number) => `显示 ${count} 条已解决的评论`,
    },
    grid: {
      snap: '吸附到网格',
      stopSnapping: '停止吸附到网格',
      snappingTo: (step: number) => `正在吸附到 ${step}px 网格`,
      notSnapping: '未吸附到网格',
    },
    card: {
      untitled: '未命名',
      title: '节点标题',
    },
    spacing: {
      handle: '拖动以调整间距',
    },
    paste: {
      notLoaded: '此项目的状态和类型尚未加载，因此没有粘贴。请稍后再试。',
    },
    readingFrom: (by: string, from: string) => `${by} 正在从“${from}”开始阅读`,
  },
};
