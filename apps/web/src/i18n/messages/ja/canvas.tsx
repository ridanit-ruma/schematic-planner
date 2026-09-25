import type { Messages } from '../en';

export const canvas: Messages['canvas'] = {
  canvas: {
    menu: {
      addNode: 'ここにノードを追加',
      tidyUp: '間隔を揃える',
      duplicate: '複製',
      noteOnNode: 'このノードにコメント',
      noteHere: 'ここにコメント',
      groupNodes: (count: number) => `${count}個のノードをグループ化`,
      takeOutOf: (box: string) => `${box}から出す`,
      takeOutOfBox: 'グループから出す',
      standardWidth: '標準の幅に戻す',
      deleteNode: 'ノードを削除',
      deleteConnection: '接続を削除',
      undo: '元に戻す',
      redo: 'やり直す',
      fitPlan: 'プラン全体を表示',
      gridSpacing: 'グリッド間隔',
      gridStep: (step: number) => `${step} px`,
      snapBy: 'スナップ基準',
      snapTerminals: '接続点',
      snapOuterEdge: '外枠',
      hideResolved: (count: number) => `解決済みのコメント${count}件を隠す`,
      showResolved: (count: number) => `解決済みのコメント${count}件を表示`,
    },
    grid: {
      snap: 'グリッドにスナップ',
      stopSnapping: 'グリッドへのスナップを解除',
      snappingTo: (step: number) => `${step}px グリッドにスナップ中`,
      notSnapping: 'グリッドにスナップしていません',
    },
    card: {
      untitled: '無題',
      title: 'ノードのタイトル',
    },
    spacing: {
      handle: 'ドラッグして間隔を変更',
    },
    readingFrom: (by: string, from: string) => `${by}が${from}から読み進めています`,
  },
};
