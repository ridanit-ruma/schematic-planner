import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const workspaces: Messages['workspaces'] = {
  /** A role's display name. The enum value sent to the API stays as it is. */
  roles: {
    OWNER: 'オーナー',
    ADMIN: '管理者',
    EDITOR: '編集者',
    VIEWER: '閲覧者',
  },
  /** The ruled index shared by the project, plan and folder screens. */
  list: {
    name: '名前',
    holds: '内容',
    updated: '更新日時',
    actions: '操作',
    settings: '設定',
    moveToFolder: 'フォルダに移動…',
    moveToTrash: 'ゴミ箱に移動',
    nodeCount: (n: number) => `ノード${n}個`,
    planCount: (n: number) => `プラン${n}件`,
    confirmTrash: (name: string) => `${name}をゴミ箱に移動しますか？`,
    planTrashBody: 'どの一覧にも表示されなくなります。ゴミ箱から元に戻せます。',
    folderTrashBody: '中のプランも一緒に移動し、元に戻すときも一緒に戻ります。',
    renameFolder: 'フォルダ名を変更',
  },
  newPlan: {
    title: '新しいプラン',
    titleLabel: 'タイトル',
    titlePlaceholder: '会計台帳の移行',
    descriptionLabel: '説明',
    descriptionHint: 'このプランで何を描くか。1行で、一覧に表示されます。',
    descriptionPlaceholder: '請求書が台帳から PDF になるまでの流れ。',
    submit: 'プランを作成',
    createFirst: '最初のプランを作成',
  },
  projects: {
    title: 'プロジェクト',
    description: (projects: number, workspace: string) =>
      projects === 0
        ? `${workspace}にはまだ何もありません。`
        : `${workspace}のプロジェクト：${projects}件`,
    newProject: '新しいプロジェクト',
    empty: {
      title: 'プロジェクトがありません',
      body: 'プロジェクトは、作ろうとしているひとつのもののプランをまとめます。多くのワークスペースは、プロジェクト1つから始まります。',
      action: '最初のプロジェクトを作成',
    },
    project: 'プロジェクト',
    plans: 'プラン',
    trashBody: '中のプランも一緒に移動します。プロジェクトはゴミ箱から丸ごと元に戻せます。',
    create: {
      title: '新しいプロジェクト',
      nameLabel: '名前',
      nameHint: 'アドレスは名前から生成され、あとから変わることはありません。',
      namePlaceholder: '請求機能の刷新',
      descriptionLabel: '説明',
      descriptionHint: 'このプロジェクトの目的。1行で、一覧に表示されます。',
      descriptionPlaceholder: '請求処理をモノリスから切り出す。',
      submit: 'プロジェクトを作成',
    },
  },
  plans: {
    title: 'プラン',
    description: (folders: number, plans: number) => {
      const counts = [
        ...(folders === 0 ? [] : [`フォルダ${folders}個`]),
        ...(plans === 0 ? [] : [`プラン${plans}件`]),
      ];
      return counts.length === 0
        ? 'このプロジェクトにはまだ何も描かれていません。'
        : `このプロジェクトの内容：${counts.join(' · ')}`;
    },
    newFolder: '新しいフォルダ',
    empty: {
      title: 'プランがありません',
      body: 'ここでプランを描くか、AI エージェントにこのワークスペースを指定して最初のプランを作成させましょう。',
    },
    createFolder: {
      title: '新しいフォルダ',
      nameLabel: '名前',
      nameHint: 'このプロジェクト内の整理用の引き出しです。フォルダは入れ子にできません。',
      namePlaceholder: 'アーキテクチャ',
      submit: 'フォルダを作成',
    },
  },
  folder: {
    title: 'フォルダ',
    missing: {
      title: 'フォルダが見つかりません',
      body: '削除されたか、別のプロジェクトに属している可能性があります。',
      back: (project: string) => `${project}に戻る`,
    },
    description: (plans: number) =>
      plans === 0 ? 'このフォルダにはまだ何もありません。' : `このフォルダのプラン：${plans}件`,
    moveFolderToTrash: 'フォルダをゴミ箱に移動',
    empty: {
      title: 'このフォルダは空です',
      body: 'ここでプランを描くか、プロジェクトからプランを移動してください。',
    },
  },
  moveToFolder: {
    title: (plan: string) => `${plan}を移動`,
    description: 'このプロジェクト内のどのフォルダに入れるかを選びます。',
    folder: 'フォルダ',
    topLevel: '最上位',
    topLevelHint: 'どのフォルダにも入れない',
    submit: '移動',
  },
  projectSettings: {
    title: 'プロジェクト設定',
    description: 'このプロジェクトの名前と、その扱いを設定します。',
    openPlans: 'プランを開く',
    name: {
      title: '名前',
      body: '名前を変えてもアドレスは変わりません。誰かが保存したリンクは、そのまま使えます。',
      label: 'プロジェクト名',
      description: '説明',
    },
    delete: {
      title: 'このプロジェクトを削除',
      body: '中のプランと一緒にゴミ箱に移動します。元に戻すと、中にあったものがそのまま戻ります。',
    },
  },
  settings: {
    title: 'ワークスペース設定',
    name: {
      title: '名前',
      body: (slug: ReactNode) => (
        <>
          名前を変えても、アドレスは {slug}{' '}
          のまま変わりません。誰かが保存したリンクは、そのまま使えます。
        </>
      ),
      label: 'ワークスペース名',
    },
    delete: {
      title: 'このワークスペースを削除',
      body: (workspace: string) =>
        `${workspace}のすべてのプロジェクト、プラン、API キーが削除され、全員が利用できなくなります。残したいものは先にエクスポートしてください。エクスポートしたファイルは、このサービスがなくても読めます。`,
      action: 'ワークスペースを削除',
      confirmTitle: (workspace: string) => `${workspace}を削除`,
      confirmBody: 'この操作は取り消せません。確認のため、ワークスペース名を入力してください。',
      typeName: (workspace: string) => `「${workspace}」と入力`,
    },
  },
  members: {
    title: 'メンバー',
    description: (workspace: string) => `${workspace}を開けるすべてのメンバーです。`,
    invite: 'メンバーを招待',
    empty: {
      title: 'メンバーがいません',
      body: 'この状態にはならないはずです。ワークスペースには必ずオーナーがいます。',
    },
    person: 'メンバー',
    role: '役割',
    you: 'あなた',
    roleHelp: {
      VIEWER: 'プランの閲覧とエクスポートができます。',
      EDITOR: 'プランの編集と、エージェント用キーの作成ができます。',
      ADMIN: 'さらに、メンバーの招待と役割の変更ができます。',
      OWNER: 'さらに、ワークスペースを削除できます。',
    },
    invitations: {
      title: '受付中の招待',
      body: 'まだ参加に使えるリンクです。使用済みや期限切れのものは表示されません。取り消すと、すぐに使えなくなります。',
      link: 'リンク',
      role: '役割',
      expires: '有効期限',
      issuedEarlier: '以前に発行',
      by: (name: string) => `発行者：${name}`,
      withdraw: '取り消す',
    },
    inviteModal: {
      title: 'メンバーを招待',
      description:
        'リンクを作成します。リンクを開いた人は、選んだ役割でこのワークスペースに参加します。',
      role: '役割',
      submit: 'リンクを作成',
      expiry:
        'リンクの有効期限は14日間です。メール送信機能はまだないため、ご自身で送ってください。',
      copy: 'コピー',
    },
  },
  invite: {
    documentTitle: '招待',
    invitedYou: (inviter: ReactNode) => <>{inviter}さんから招待が届いています</>,
    asRole: {
      OWNER: (role: ReactNode) => (
        <>{role}として参加します。ワークスペースの削除を含め、すべてを管理できます。</>
      ),
      ADMIN: (role: ReactNode) => (
        <>{role}として参加します。メンバーとプロジェクトを管理できます。</>
      ),
      EDITOR: (role: ReactNode) => <>{role}として参加します。すべてのプランを編集できます。</>,
      VIEWER: (role: ReactNode) => <>{role}として参加します。すべてのプランを閲覧できます。</>,
      other: (role: ReactNode) => <>{role}として参加します。</>,
    },
    settled: {
      accepted: (inviter: string) =>
        `この招待はすでに使用されています。${inviter}さんに新しい招待を依頼してください。`,
      declined: (inviter: string) =>
        `この招待は辞退されています。${inviter}さんに新しい招待を依頼してください。`,
      expired: (inviter: string) =>
        `この招待は期限切れです。${inviter}さんに新しい招待を依頼してください。`,
    },
    alreadyMember: 'すでにこのワークスペースのメンバーです。',
    open: (workspace: string) => `${workspace}を開く`,
    signInToAccept: 'ログインして承諾',
    createAccount: 'アカウントを作成',
    otherAddress: (invited: ReactNode, signedIn: ReactNode) => (
      <>
        この招待は {invited} 宛てですが、現在 {signedIn}{' '}
        でログインしています。承諾すると、ログイン中のアカウントで参加します。
      </>
    ),
    accept: '承諾',
    decline: '辞退',
    signedInAs: (email: string) => `${email} でログイン中`,
  },
  trash: {
    title: 'ゴミ箱',
    description:
      '削除したプランとプロジェクトはここに残ります。自動で消えることはありません。元に戻すか、完全に削除してください。',
    emptyTrash: 'ゴミ箱を空にする',
    empty: {
      title: 'ゴミ箱は空です',
      body: '削除したプランやプロジェクトは、消えずにここに移動します。',
    },
    item: '項目',
    wasIn: '元の場所',
    deleted: '削除日時',
    kinds: {
      plan: 'プラン',
      project: 'プロジェクト',
      folder: 'フォルダ',
    },
    shared: '共有中',
    by: (name: string) => `削除者：${name}`,
    restore: '元に戻す',
    stopSharing: '共有を停止',
    deleteForGood: '完全に削除',
    purge: {
      title: (name: string) => `${name}を完全に削除しますか？`,
      project: 'プロジェクトと、その中のすべてのプランが削除されます。この操作は取り消せません。',
      folder:
        'フォルダは削除され、中のプランはプロジェクトの最上位に戻ります。この操作は取り消せません。',
      plan: 'プランとその履歴、共有リンクが削除されます。この操作は取り消せません。',
    },
    emptyModal: {
      title: 'ゴミ箱を空にしますか？',
      body: (items: number) => `${items}件の項目が完全に削除されます。この操作は取り消せません。`,
    },
  },
};
