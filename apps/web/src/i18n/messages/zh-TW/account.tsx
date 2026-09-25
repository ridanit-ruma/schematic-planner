import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const account: Messages['account'] = {
  layout: {
    title: '帳號',
    tabAccount: '帳號',
    tabKeys: 'MCP 金鑰',
  },
  documentTitle: '帳號',
  client: {
    unknown: '未知的用戶端',
    unknownBrowser: '未知的瀏覽器',
    unknownPlatform: '未知的平台',
    on: (browser: string, platform: string) => `${platform} 上的 ${browser}`,
  },
  picture: {
    title: '大頭貼',
    body: '會顯示在所有出現你的地方：成員清單、計畫的歷史紀錄，以及你在畫布上的游標。',
    add: '新增大頭貼',
    replace: '更換',
    modalTitle: '你的大頭貼',
  },
  avatarEditor: {
    unreadable: '無法將這個檔案讀取為圖片。',
    zoom: '縮放',
    hint: (size: number) => `拖曳圖片以調整位置。將儲存為 ${size}×${size} 的正方形。`,
    saving: '儲存中…',
    save: '儲存大頭貼',
  },
  name: {
    title: '名稱',
    emailNote: (email: ReactNode) => (
      <>
        與你共用工作區的人會看到這個名稱。你的電子郵件是 {email}
        ；變更電子郵件需要寄信功能，目前尚未實作。
      </>
    ),
    label: '顯示名稱',
  },
  password: {
    title: '密碼',
    body: '變更密碼會登出其他所有工作階段。如果你是因為懷疑密碼外洩而變更，這正是用意所在。',
    current: '目前的密碼',
    new: '新密碼',
    newHint: '至少 10 個字元。',
    changed: '密碼已變更',
    change: '變更密碼',
  },
  sessions: {
    title: '登入中的裝置',
    body: '結束你不認得的工作階段。目前這個工作階段不受影響。',
    endOthers: '結束其他工作階段',
    thisOne: '目前使用中',
    started: (when: string) => `登入於 ${when}`,
    end: '結束',
  },
  remove: {
    title: '刪除帳號',
    body: '你擁有的一切都會一併刪除：你是唯一擁有者的工作區，以及其中的所有專案與計畫。請先匯出想保留的內容。',
    button: '刪除帳號',
    modalTitle: '刪除帳號',
    modalDescription: '此操作無法復原。請輸入密碼確認。',
    password: '密碼',
    confirm: '刪除我的帳號',
  },
};
