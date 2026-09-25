import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const account: Messages['account'] = {
  layout: {
    title: 'アカウント',
    tabAccount: 'アカウント',
    tabKeys: 'MCP キー',
  },
  documentTitle: 'アカウント',
  client: {
    unknown: '不明なクライアント',
    unknownBrowser: '不明なブラウザ',
    unknownPlatform: '不明なプラットフォーム',
    on: (browser: string, platform: string) => `${browser}（${platform}）`,
  },
  picture: {
    title: 'プロフィール画像',
    body: 'メンバー一覧、プランの履歴、キャンバス上のカーソルなど、あなたが表示されるあらゆる場所に使われます。',
    add: '画像を追加',
    replace: '変更',
    modalTitle: 'プロフィール画像',
  },
  avatarEditor: {
    unreadable: 'このファイルは画像として読み込めませんでした。',
    zoom: 'ズーム',
    hint: (size: number) =>
      `ドラッグして位置を調整します。${size}×${size} の正方形で保存されます。`,
    saving: '保存中…',
    save: '画像を保存',
  },
  name: {
    title: '名前',
    emailNote: (email: ReactNode) => (
      <>
        ワークスペースを共有している人に表示される名前です。メールアドレスは {email}{' '}
        です。メールの送信機能がまだないため、メールアドレスは変更できません。
      </>
    ),
    label: '表示名',
  },
  password: {
    title: 'パスワード',
    body: '変更すると、ほかのすべてのセッションからログアウトします。漏えいが心配で変更する場合は、まさにそのための仕組みです。',
    current: '現在のパスワード',
    new: '新しいパスワード',
    newHint: '10文字以上。',
    changed: 'パスワードを変更しました',
    change: 'パスワードを変更',
  },
  sessions: {
    title: 'ログイン中のセッション',
    body: '心当たりのないセッションは終了してください。このセッションは残ります。',
    endOthers: 'ほかをすべて終了',
    thisOne: 'このセッション',
    started: (when: string) => `開始：${when}`,
    end: '終了',
  },
  remove: {
    title: 'アカウントを削除',
    body: 'あなたが所有するものはすべて削除されます。あなたが唯一のオーナーであるワークスペースと、その中のすべてのプロジェクトとプランも含まれます。残したいものは先にエクスポートしてください。',
    button: 'アカウントを削除',
    modalTitle: 'アカウントを削除',
    modalDescription: 'この操作は取り消せません。パスワードを入力して確認してください。',
    password: 'パスワード',
    confirm: 'アカウントを削除する',
  },
};
