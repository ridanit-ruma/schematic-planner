import type { ReactNode } from 'react';

import type { Messages } from '../en';

export const account: Messages['account'] = {
  layout: {
    title: '账号',
    tabAccount: '账号',
    tabKeys: 'MCP 密钥',
  },
  documentTitle: '账号',
  client: {
    unknown: '未知客户端',
    unknownBrowser: '未知浏览器',
    unknownPlatform: '未知平台',
    on: (browser: string, platform: string) => `${platform} 上的 ${browser}`,
  },
  picture: {
    title: '头像',
    body: '会显示在所有出现你的地方，比如成员列表、计划的历史记录，以及你在画布上的光标。',
    add: '添加头像',
    replace: '更换',
    modalTitle: '你的头像',
  },
  avatarEditor: {
    unreadable: '无法将该文件识别为图片。',
    zoom: '缩放',
    hint: (size: number) => `拖动图片以调整位置。图片将保存为 ${size}×${size} 的正方形。`,
    saving: '正在保存…',
    save: '保存头像',
  },
  name: {
    title: '名称',
    emailNote: (email: ReactNode) => (
      <>
        与你共享工作区的人会看到这个名称。你的邮箱是 {email}
        ；更改邮箱需要发送邮件，而这项功能尚未实现。
      </>
    ),
    label: '显示名称',
  },
  password: {
    title: '密码',
    body: '修改密码会让其他所有会话退出登录。如果你是担心密码泄露才修改的，这正是用意所在。',
    current: '当前密码',
    new: '新密码',
    newHint: '至少 10 个字符。',
    changed: '密码已修改',
    change: '修改密码',
  },
  sessions: {
    title: '已登录的设备',
    body: '结束你不认识的会话。当前会话会保留。',
    endOthers: '结束其他会话',
    thisOne: '当前会话',
    started: (when: string) => `开始于 ${when}`,
    end: '结束',
  },
  remove: {
    title: '删除账号',
    body: '你拥有的一切都会随之删除：你是唯一所有者的工作区，以及其中所有的项目和计划。请先导出你想保留的内容。',
    button: '删除账号',
    modalTitle: '删除账号',
    modalDescription: '此操作无法撤销。请输入密码确认。',
    password: '密码',
    confirm: '删除我的账号',
  },
};
