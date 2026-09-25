import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const plan: Messages['plan'] = {
  labels: {
    nodeKind: {
      feature: '功能',
      task: '任務',
      decision: '決策',
      note: '備註',
      group: '群組',
    },
    status: {
      idea: '構想',
      planned: '已規劃',
      in_progress: '進行中',
      blocked: '受阻',
      done: '已完成',
      dropped: '已放棄',
    },
    edgeKind: {
      flows_to: '流向',
      depends_on: '依賴',
      contains: '包含',
      relates_to: '關聯',
    },
    edgeMeaning: {
      flows_to: '控制權或資料沿這個方向移動。回應是另一條反方向的流向。',
      depends_on: '決定兩者的先後順序。匯出時會成為各檔名前的編號。',
      contains: '表示一個節點包含在另一個之中。匯出時會成為資料夾。',
      relates_to: '單純的關聯，不帶任何結構。',
    },
  },
  inspector: {
    title: '標題',
    identifier: '識別碼',
    identifierClash: '已有其他節點使用這個識別碼',
    identifierMalformed: '以單一連字號連接的小寫英文單字',
    identifierHint: 'AI 代理用來指稱這個節點的名稱，也是匯出時的檔名',
    kind: '類型',
    status: '狀態',
    tags: '標籤',
    tagsHint: '以逗號分隔',
    detail: '詳細內容',
    detailHint: '支援 Markdown，並在畫布上以 Markdown 呈現',
    nothingYet: '尚無內容',
    deleteNode: '刪除節點',
    deleteNodeNote: '刪除這個節點，以及與它相連的所有連接。',
  },
  edgeInspector: {
    connection: '連接',
    meaning: '意義',
    setOffBy: '觸發條件',
    setOffByHint: '啟動它的事件：點擊、路由、請求、計時器。',
    setOffByPlaceholder: '點擊「登入」',
    carries: '傳遞內容',
    carriesHint: '沿著它傳遞的東西：酬載、紀錄、回傳值。',
    label: '標示',
    labelHint: '顯示在連接線上。選填。',
    straighten: '拉直',
    removeConnection: '移除連接',
  },
  history: {
    title: '歷史紀錄',
    empty: '尚無紀錄。這個計畫的每一次變更都會記錄在這裡，不論是誰做的。',
    fewer: '收合',
    eachOne: '逐筆顯示',
    /** Who did it, then what they did. */
    entry: (author: ReactNode, line: string) => (
      <>
        {author} {line}
      </>
    ),
    /** Stands in for the subject when a change to the plan itself carries no name. */
    thisPlan: '這個計畫',
    /** The value a status change ended on, keyed by the status. */
    statusWord: {
      idea: '構想',
      planned: '已規劃',
      in_progress: '進行中',
      blocked: '受阻',
      done: '已完成',
      dropped: '已放棄',
    } as Record<string, string>,
    /** The value a kind change ended on, keyed by the kind. */
    kindWord: {
      feature: '功能',
      task: '任務',
      decision: '決策',
      note: '備註',
      group: '群組',
    } as Record<string, string>,
    change: {
      planCreated: (nodes: string | null) =>
        nodes === null ? '建立了這個計畫' : `建立了這個計畫，包含 ${nodes} 個節點`,
      planTitle: (name: string) => `將計畫重新命名為 ${name}`,
      planDescription: '撰寫了計畫說明',
      planArranged: (count: string | null) =>
        count === null ? '移動了一些節點' : `移動了 ${count} 個節點`,
      nodeAdded: (name: string) => `新增了 ${name}`,
      nodeRemoved: (name: string) => `移除了 ${name}`,
      nodeIdentifier: (name: string, slug: string) => `將 ${name} 的識別碼改為 ${slug}`,
      nodeRenamed: (from: string | null, name: string) =>
        `將 ${from ?? '一個節點'} 重新命名為 ${name}`,
      nodeStatus: (name: string, status: string | null) =>
        status === null ? `變更了 ${name} 的狀態` : `將 ${name} 設為「${status}」`,
      nodeKind: (name: string, kind: string | null) =>
        kind === null ? `將 ${name} 改為其他類型` : `將 ${name} 改為「${kind}」`,
      nodeBody: (name: string) => `編輯了 ${name} 的內容`,
      nodeTagsCleared: (name: string) => `清除了 ${name} 的標籤`,
      nodeTags: (name: string, tags: string) => `為 ${name} 加上標籤 ${tags}`,
      nodeMetaCleared: (name: string) => `清除了 ${name} 的額外欄位`,
      nodeMeta: (name: string, fields: string) => `設定了 ${name} 的 ${fields}`,
      edgeAdded: (name: string) => `新增了連接 ${name}`,
      edgeRemoved: (name: string) => `移除了連接 ${name}`,
      noteAdded: (name: string) => `在 ${name} 上留言`,
      noteRemoved: (name: string) => `刪除了 ${name} 上的留言`,
      noteEdited: (name: string) => `修改了 ${name} 上的留言`,
      noteAnswered: (name: string) => `回覆了 ${name} 上的留言`,
      noteResolved: (name: string) => `將 ${name} 上的留言標為已解決`,
      noteReopened: (name: string) => `重新開啟了 ${name} 上的留言`,
      other: (name: string) => `變更了 ${name}`,
    },
    /** A folded batch, counted: `+41 個節點、+62 個連接`. `change` is the signed counts. */
    summary: {
      nodes: (change: string) => `${change} 個節點`,
      connections: (change: string) => `${change} 個連接`,
      notes: (change: string) => `${change} 則留言`,
      edits: (count: number) => `${count} 次編輯`,
      separator: '、',
      madeChanges: '做了一些變更',
    },
  },
  comments: {
    someone: '某人',
    placeholder: '對這裡有什麼想法？',
    empty: '空白留言',
    reopen: '重新開啟',
    resolve: '標為已解決',
    deleteNote: '刪除留言',
  },
  titleBlock: {
    planSettings: '計畫設定',
    nextNote: '前往下一則未解決的留言',
    addNode: '新增節點',
    planActions: '計畫操作',
    arrange: '自動排列',
    share: '分享',
    history: '歷史紀錄',
    hideHistory: '隱藏歷史紀錄',
    export: '匯出',
    onlyYou: '只有你在這裡',
    peopleHere: (count: number) => `${count} 人在這裡`,
    you: '你',
    nodeCount: (count: number) => `${count} 個節點`,
    connected: '已連線',
    connecting: '連線中',
    disconnected: '未連線：重新連線前，變更只會保存在本機',
  },
  page: {
    untitled: '未命名計畫',
    addNode: '新增節點',
    title: '標題',
    titleHint: '識別碼會依標題產生，之後可以變更。',
    titlePlaceholder: '身分驗證',
    shareTitle: '分享這個計畫',
    shareDescription: '任何擁有這個連結的人都能閱讀計畫並下載匯出檔，但無法修改。',
    stopSharing: '停止分享',
    copyLink: '複製連結',
  },
  settings: {
    title: '計畫設定',
    description: '除了圖面本身以外，與這個計畫有關的一切。',
    openCanvas: '開啟畫布',
    name: {
      title: '名稱',
      description: '顯示在所有清單和畫布上的名稱。',
      titleField: '標題',
      descriptionField: '說明',
      descriptionHint: '一行文字，顯示在清單中的標題下方。',
    },
    location: {
      title: '所在位置',
      description: '計畫移動後網址不變，所有指向它的連結都仍然有效。',
      workspace: '工作區',
      project: '專案',
      noProject: '該工作區沒有可以放入的專案。',
      leaving: (workspace: string) =>
        `將它移出 ${workspace} 後，那裡的所有人都將無法存取，分享連結也會失效，因為當初發出那個連結時，是以誰能存取這個計畫為前提。`,
      move: '移動',
    },
    trash: {
      title: '刪除這個計畫',
      description: '計畫會移到工作區的垃圾桶，可以在那裡還原或永久刪除。',
      moveToTrash: '移到垃圾桶',
      confirmTitle: (title: string) => `要將 ${title} 移到垃圾桶嗎？`,
      confirmDescription: '它將不再出現在任何列出它的地方。你可以從垃圾桶還原。',
    },
    in: (workspace: ReactNode) => <>位於 {workspace}。</>,
  },
  shared: {
    goHome: '前往 Schematic Planner',
    readOnly: '唯讀',
    export: '匯出',
  },
  group: {
    /** What a group is called before anybody names it. */
    defaultTitle: '群組',
  },
};
