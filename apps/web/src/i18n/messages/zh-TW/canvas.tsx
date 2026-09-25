import type { Messages } from '../en';

export const canvas: Messages['canvas'] = {
  canvas: {
    menu: {
      addNode: '在此新增節點',
      tidyUp: '整理間距',
      duplicate: '建立副本',
      noteOnNode: '在這個節點上留言',
      noteHere: '在這裡留言',
      groupNodes: (count: number) => `將 ${count} 個節點組成群組`,
      takeOutOf: (box: string) => `從 ${box} 移出`,
      takeOutOfBox: '移出群組',
      standardWidth: '使用標準寬度',
      deleteNode: '刪除節點',
      deleteConnection: '刪除連接',
      undo: '復原',
      redo: '重做',
      fitPlan: '顯示整個計畫',
      gridSpacing: '格線間距',
      gridStep: (step: number) => `${step} px`,
      snapBy: '對齊依據',
      snapTerminals: '端點',
      snapOuterEdge: '外框',
      hideResolved: (count: number) => `隱藏 ${count} 則已解決的留言`,
      showResolved: (count: number) => `顯示 ${count} 則已解決的留言`,
    },
    grid: {
      snap: '對齊格線',
      stopSnapping: '停止對齊格線',
      snappingTo: (step: number) => `對齊 ${step}px 格線`,
      notSnapping: '未對齊格線',
    },
    card: {
      untitled: '未命名',
      title: '節點標題',
    },
    spacing: {
      handle: '拖曳以調整間距',
    },
    readingFrom: (by: string, from: string) => `${by} 正從 ${from} 開始讀取`,
  },
};
