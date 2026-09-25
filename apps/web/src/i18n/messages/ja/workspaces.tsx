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
  /** Words the remaining tables and their row menus share. */
  list: {
    actions: '操作',
    moveToTrash: 'ゴミ箱に移動',
    confirmTrash: (name: string) => `${name}をゴミ箱に移動しますか？`,
  },
  projects: {
    trashBody: '中のプランも一緒に移動します。プロジェクトはゴミ箱から丸ごと元に戻せます。',
  },
  projectSettings: {
    title: 'プロジェクト設定',
    description: 'このプロジェクトの名前と、その扱いを設定します。',
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
