import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const plan: Messages['plan'] = {
  labels: {
    nodeKind: {
      feature: '機能',
      task: 'タスク',
      decision: '決定',
      note: 'メモ',
      group: 'グループ',
    },
    status: {
      idea: 'アイデア',
      planned: '計画済み',
      in_progress: '進行中',
      blocked: 'ブロック中',
      done: '完了',
      dropped: '中止',
    },
    edgeKind: {
      flows_to: 'フロー',
      depends_on: '依存',
      contains: '包含',
      relates_to: '関連',
    },
    edgeMeaning: {
      flows_to: '制御やデータがこの向きに流れます。応答は、逆向きの別のフローとして描きます。',
      depends_on: '2つの順序を決めます。エクスポート時に、各ファイル名の番号になります。',
      contains: '一方をもう一方の中に入れ子にします。エクスポート時に、ディレクトリになります。',
      relates_to: '単なる関連付けです。構造は持ちません。',
    },
  },
  inspector: {
    title: 'タイトル',
    identifier: '識別子',
    identifierClash: 'この識別子はほかのノードで使われています',
    identifierMalformed: '小文字の単語をハイフン1つでつないでください',
    identifierHint:
      'エージェントがこのノードを指す名前です。エクスポート時のファイル名にもなります',
    kind: '種類',
    status: 'ステータス',
    tags: 'タグ',
    tagsHint: 'カンマ区切り',
    detail: '詳細',
    nothingYet: 'まだ何もありません',
    deleteNode: 'ノードを削除',
    deleteNodeNote: 'ノードと、そこにつながるすべての接続を削除します。',
    due: '期限',
    dueUnreadable: (due: string) =>
      `「${due}」は読み取れる日付ではありません。日付を選ぶとこの値に置き換わります。`,
  },
  edgeInspector: {
    connection: '接続',
    meaning: '意味',
    setOffBy: 'きっかけ',
    setOffByHint: '何によって始まるか。クリック、ルート、リクエスト、タイマーなど。',
    setOffByPlaceholder: '「ログイン」をクリック',
    carries: '渡すもの',
    carriesHint: 'この接続を通って渡るもの。ペイロード、レコード、戻り値など。',
    label: 'ラベル',
    labelHint: '線の上に表示されます。任意。',
    straighten: 'まっすぐにする',
    removeConnection: '接続を削除',
    leaves: '出る辺',
    arrives: '入る辺',
    sidesHint: '辺を指定した線はその間を直角に描き、曲げられません。自動に戻すと曲げられます。',
    sides: { auto: '自動', top: '上', right: '右', bottom: '下', left: '左' },
  },
  history: {
    title: '履歴',
    empty: 'まだ何もありません。このプランへの変更は、誰が行ったものでもすべてここに記録されます。',
    fewer: 'たたむ',
    eachOne: '内訳を表示',
    /** Who did it, then what they did. */
    entry: (author: ReactNode, line: string) => (
      <>
        {author}が{line}
      </>
    ),
    /** Stands in for the subject when a change to the plan itself carries no name. */
    thisPlan: 'このプラン',
    /** The value a status change ended on, keyed by the status. */
    statusWord: {
      idea: 'アイデア',
      planned: '計画済み',
      in_progress: '進行中',
      blocked: 'ブロック中',
      done: '完了',
      dropped: '中止',
    } as Record<string, string>,
    /** The value a kind change ended on, keyed by the kind. */
    kindWord: {
      feature: '機能',
      task: 'タスク',
      decision: '決定',
      note: 'メモ',
      group: 'グループ',
    } as Record<string, string>,
    change: {
      planCreated: (nodes: string | null) =>
        nodes === null ? 'このプランを作成しました' : `ノード${nodes}個でこのプランを作成しました`,
      planTitle: (name: string) => `プラン名を「${name}」に変更しました`,
      planDescription: 'プランの説明を編集しました',
      planArranged: (count: string | null) =>
        count === null ? 'いくつかのノードを移動しました' : `ノード${count}個を移動しました`,
      nodeAdded: (name: string) => `${name}を追加しました`,
      nodeRemoved: (name: string) => `${name}を削除しました`,
      nodeIdentifier: (name: string, slug: string) => `${name}の識別子を ${slug} に変更しました`,
      nodeRenamed: (from: string | null, name: string) =>
        `${from ?? 'ノード'}の名前を${name}に変更しました`,
      nodeStatus: (name: string, status: string | null) =>
        status === null
          ? `${name}のステータスを変更しました`
          : `${name}のステータスを${status}にしました`,
      nodeKind: (name: string, kind: string | null) =>
        kind === null ? `${name}の種類を変更しました` : `${name}の種類を${kind}にしました`,
      nodeBody: (name: string) => `${name}の内容を編集しました`,
      nodeTagsCleared: (name: string) => `${name}のタグをすべて外しました`,
      nodeTags: (name: string, tags: string) => `${name}にタグ ${tags} を付けました`,
      nodeMetaCleared: (name: string) => `${name}の追加フィールドを削除しました`,
      nodeMeta: (name: string, fields: string) => `${name}に ${fields} を設定しました`,
      edgeAdded: (name: string) => `${name}を接続しました`,
      edgeRemoved: (name: string) => `${name}の接続を解除しました`,
      noteAdded: (name: string) => `${name}にコメントしました`,
      noteRemoved: (name: string) => `${name}のコメントを削除しました`,
      noteEdited: (name: string) => `${name}のコメントを編集しました`,
      noteAnswered: (name: string) => `${name}のコメントに返信しました`,
      noteResolved: (name: string) => `${name}のコメントを解決しました`,
      noteReopened: (name: string) => `${name}のコメントを再開しました`,
      other: (name: string) => `${name}を変更しました`,
    },
    /** A folded batch, counted: `+41 nodes, +62 connections`. `change` is the signed counts. */
    summary: {
      nodes: (change: string, _total: number) => `ノード ${change}`,
      connections: (change: string, _total: number) => `接続 ${change}`,
      notes: (change: string, _total: number) => `コメント ${change}`,
      edits: (count: number) => `編集 ${count}件`,
      separator: '、',
      madeChanges: 'いくつか変更を加えました',
    },
  },
  comments: {
    someone: '不明なユーザー',
    placeholder: 'コメントを入力',
    empty: '空のコメント',
    reopen: '再開',
    resolve: '解決',
    deleteNote: 'コメントを削除',
  },
  views: {
    switchView: '表示',
    canvas: 'キャンバス',
    table: '表',
    board: 'ボード',
    otherStatuses: 'その他のステータス',
    empty: 'ノードはまだありません',
    unsaved: '未保存のビュー',
    edited: '変更あり',
    saveChanges: '変更を保存',
    saveAs: '新しいビューとして保存…',
    deleteView: 'このビューを削除',
    filter: 'フィルター',
    clearFilter: 'フィルターをクリア',
    noTags: 'タグはまだありません',
    search: 'タイトルと詳細から検索',
    saveTitle: 'このビューを保存',
    saveDescription: 'ここで保存したビューはプロジェクトの全員に表示されます。',
    viewName: '名前',
    noMatch: 'このフィルターに一致するノードはありません',
    filterCount: (count: number) => `フィルター · ${count}`,
    timeline: 'タイムライン',
    matrix: 'マトリクス',
    noDate: '日付なし',
    noTag: 'タグなし',
    rows: '行',
    columns: '列',
  },
  diagnostics: {
    title: '点検',
    open: 'プランを点検',
    hide: '点検を隠す',
    clean: (checked: number) => `問題はありません。ノードと接続を ${checked} 件確認しました。`,
    severity: { error: 'エラー', warning: '警告', info: '注記' },
    rules: {
      dependencyCycle: (names: string[]) =>
        `互いに循環して依存しています：${names.join('、')}。どれも先に始めることができません。`,
      isolatedNode: (name: string) => `「${name}」は何ともつながっていません。`,
      outsideFlow: (name: string) => `「${name}」はどのフローにも入っていない作業です。`,
      unknownKind: (name: string, kind: string) =>
        `「${name}」の種類「${kind}」はこのプロジェクトで定義されていません。`,
      unknownStatus: (name: string, status: string) =>
        `「${name}」のステータス「${status}」はこのプロジェクトで定義されていません。`,
    },
  },
  sources: {
    title: '出典',
    open: '出典',
    hide: '出典を隠す',
    from: 'このプランの出典',
    into: 'このプランを出典とするプラン',
    noneFrom: 'このプランには出典がありません。エージェントが set_plan_sources で設定します。',
    noneInto: 'このプランを出典に挙げているプランはありません。',
    elsewhere: '開けないプラン',
    gone: '削除されたプラン',
    state: { missing: '見つかりません', moved: '別のプロジェクトにあります' },
  },
  versions: {
    title: 'バージョン',
    open: 'バージョン',
    hide: 'バージョンを隠す',
    save: '保存',
    labelHint: 'このバージョンの名前（任意）',
    saved: '保存したバージョン',
    beforeAgent: 'エージェントの変更前',
    beforeRestore: '復元の前',
    restore: '復元',
    restoreTitle: 'このバージョンに復元しますか？',
    restoreDescription:
      'プランはその時点の状態に戻り、全員にそのまま表示されます。現在の状態は先にバージョンとして残すので、元に戻せます。',
    empty: 'まだありません。エージェントが変更する前と、誰かが保存したときにバージョンが残ります。',
  },
  titleBlock: {
    planSettings: 'プラン設定',
    nextNote: '次の未解決コメントへ',
    addNode: 'ノードを追加',
    planActions: 'プランの操作',
    arrange: '自動レイアウト',
    share: '共有',
    history: '履歴',
    hideHistory: '履歴を隠す',
    export: 'エクスポート',
    onlyYou: '参加者はあなただけです',
    peopleHere: (count: number) => `${count}人が参加中`,
    you: 'あなた',
    nodeCount: (count: number) => `ノード${count}個`,
    connected: '接続済み',
    connecting: '接続中',
    disconnected: '未接続：再接続するまで変更はこの端末にのみ保存されます',
  },
  page: {
    untitled: '無題のプラン',
    shareTitle: 'このプランを共有',
    shareDescription:
      'このリンクを知っている人は誰でも、プランの閲覧とエクスポートのダウンロードができます。変更はできません。',
    stopSharing: '共有を停止',
    copyLink: 'リンクをコピー',
  },
  settings: {
    title: 'プラン設定',
    description: '描画以外の、このプランに関するすべての設定です。',
    openCanvas: 'キャンバスを開く',
    name: {
      title: '名前',
      description: 'すべての一覧とキャンバスで表示される名前です。',
      titleField: 'タイトル',
      descriptionField: '説明',
      descriptionHint: '1行で。一覧でタイトルの下に表示されます。',
    },
    location: {
      title: '保存場所',
      description:
        'プランは移動してもアドレスが変わらないため、既存のリンクはすべてそのまま使えます。',
      workspace: 'ワークスペース',
      project: 'プロジェクト',
      noProject: 'このワークスペースには、移動先のプロジェクトがありません。',
      leaving: (workspace: string) =>
        `${workspace}から移動すると、そこにいる全員がこのプランにアクセスできなくなり、共有リンクも無効になります。共有リンクは、誰がプランにアクセスできるかを前提に渡されたものだからです。`,
      move: '移動',
    },
    trash: {
      title: 'このプランを削除',
      description:
        'ワークスペースのゴミ箱に移動します。ゴミ箱から復元することも、完全に削除することもできます。',
      moveToTrash: 'ゴミ箱に移動',
      confirmTitle: (title: string) => `${title}をゴミ箱に移動しますか？`,
      confirmDescription: 'どの一覧にも表示されなくなります。ゴミ箱から元に戻せます。',
    },
    in: (workspace: ReactNode) => <>ワークスペース：{workspace}</>,
  },
  shared: {
    goHome: 'Schematic Planner へ',
    readOnly: '閲覧のみ',
    export: 'エクスポート',
  },
  group: {
    /** What a group is called before anybody names it. */
    defaultTitle: 'グループ',
  },
};
