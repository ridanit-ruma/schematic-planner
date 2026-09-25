import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const admin: Messages['admin'] = {
  layout: {
    title: 'インスタンス',
    body: '個々のワークスペースではなく、このデプロイ全体に関する設定です。',
    tabUsage: '利用状況',
    tabInvitations: '招待',
    tabPeople: 'ユーザー',
  },
  actions: '操作',
  invitations: {
    documentTitle: '招待',
    intro:
      'リンクを使うと、誰かがここでアカウントを作成できます。全員に共通のコードを渡すより、一人ひとりにリンクを渡してください。リンクなら人数を制限でき、取り消すこともでき、あとから誰が使ったかも区別できます。',
    newLink: '新しいリンク',
    code: {
      title: '登録コード',
      body: (variable: ReactNode) => (
        <>
          このデプロイの設定で指定されています。このコードを知っている人は、リンクなしで何度でもアカウントを作成でき、その記録はここに残りません。この入口を閉じるには{' '}
          {variable} を空にしてください。
        </>
      ),
    },
    copied: 'コピーしました',
    copy: 'コピー',
    empty: {
      noneOpen: '受付中の招待はありません',
      noneYet: '招待はまだありません',
      noCode: 'リンクを発行するまで、誰も登録できません。',
      onlyCode: '現在は、上のコードが唯一の登録手段です。',
    },
    columns: {
      invitation: '招待',
      used: '使用数',
      expires: '有効期限',
      state: '状態',
    },
    untitled: '無題',
    byline: (prefix: string, by: string) => `${prefix}… · 発行者：${by}`,
    uses: (uses: number, max: number | null) => (max === null ? `${uses}` : `${uses} / ${max}`),
    never: 'なし',
    states: {
      live: '有効',
      usedUp: '上限到達',
      expired: '期限切れ',
      withdrawn: '取り消し済み',
    },
    thisInvitation: 'この招待',
    withdraw: '取り消す',
    hideSpent: '受付終了の招待を隠す',
    showSpent: (count: number) => `受付終了の招待${count}件を表示`,
    create: {
      title: '新しい招待',
      label: '用途',
      labelHint: 'あなたにだけ表示されます。リンクを見分けるために使います。',
      labelPlaceholder: 'デザインレビュー用',
      limit: '登録できる人数',
      life: '有効期間',
      submit: 'リンクを発行',
    },
    limits: {
      one: '1人',
      five: '5人まで',
      twentyFive: '25人まで',
      none: '無制限',
    },
    lives: {
      day: '1日',
      week: '1週間',
      fortnight: '2週間',
      threeMonths: '3か月',
      forever: '取り消すまで',
    },
    issued: {
      title: '招待リンク',
      description:
        '今すぐコピーしてください。保存されるのはハッシュだけなので、再表示はできません。なくした場合は新しく発行してください。',
      copy: 'リンクをコピー',
    },
    remove: {
      title: 'この招待を削除しますか？',
      withAccounts: (count: number) =>
        `この招待から${count}件のアカウントが登録しています。削除すると、それらのアカウントの登録経路がわからなくなります。代わりに取り消せば、招待は使えなくなり、記録は残ります。`,
      withoutAccounts: '招待は使えなくなり、記録も消えます。代わりに取り消せば、記録は残ります。',
    },
  },
  people: {
    documentTitle: 'ユーザー',
    columns: {
      account: 'アカウント',
      holds: '保有',
      joined: '登録日',
      lastChange: '最終変更',
    },
    owner: 'オーナー',
    suspended: '停止中',
    via: (label: string) => `${label}経由`,
    viaInvitation: '招待経由',
    holds: (workspaces: number, plans: number, keys: number) =>
      [
        `ワークスペース${workspaces}件`,
        `プラン${plans}件`,
        ...(keys > 0 ? [`キー${keys}個`] : []),
      ].join(' · '),
    withdrawOwnership: 'オーナー権限を外す',
    makeOwner: 'オーナーにする',
    suspend: '利用停止',
    letBackIn: '利用を再開',
    you: 'あなた',
    signedInAs: (who: ReactNode) => (
      <>
        {who}{' '}
        としてログインしています。アカウントは削除ではなく利用停止になるため、そのアカウントが描いたものの作成者は記録に残ります。
      </>
    ),
    suspendTitle: (name: string) => `${name}を利用停止にしますか？`,
    suspendDescription:
      'すべての場所ですぐにログアウトされ、再びログインできなくなります。ワークスペース、プラン、履歴はそのまま残ります。',
  },
  usage: {
    documentTitle: '利用状況',
    openPlans: '開いているプラン',
    connections: '接続',
    rightNow: '現在',
    signedIn: 'ログイン中',
    activeIn: (active: number, days: number) => `${days}日間で${active}人がアクティブ`,
    accounts: 'アカウント',
    newAndSuspended: (joined: number, suspended: number) =>
      `新規${joined}人 · 停止中${suspended}人`,
    newIn: (joined: number, days: number) => `${days}日間で新規${joined}人`,
    drawn: {
      title: '描かれたもの',
      plans: 'プラン',
      inTrash: (count: number) => `ゴミ箱に${count}件`,
      nodes: 'ノード',
      nodesPerPlan: (count: number) => `1プランあたり平均${count}個`,
      connections: '接続',
      largestPlan: '最大のプラン',
      nodeCount: (count: number) => `ノード${count}個`,
      workspaces: 'ワークスペース',
      projectCount: (count: number) => `プロジェクト${count}件`,
    },
    agents: {
      title: 'エージェント',
      keysInUse: '使用中のキー',
      revoked: (count: number) => `無効化済み${count}個`,
      changesByAgents: 'エージェントによる変更',
      shareOfEverything: (percent: number) => `全体の${percent}%`,
      shareLinks: '共有リンク',
      invitationsOpen: '受付中の招待',
      database: 'データベース',
      lastUsed: '最終使用',
    },
    busiest: {
      title: '活動の多いワークスペース',
      changeCount: (count: number) => `変更${count}件`,
      planCount: (count: number) => `プラン${count}件`,
    },
    trend: {
      title: (days: number) => `過去${days}日間の変更`,
      aside: (changes: number, days: number) => `直近${days}日間で${changes}件`,
      byAgents: (count: number) => `エージェントによる変更${count}件`,
      byPeople: (count: number) => `人による変更${count}件`,
      people: '人',
      agents: 'エージェント',
      peak: (count: number) => `最大${count}件`,
    },
  },
};
