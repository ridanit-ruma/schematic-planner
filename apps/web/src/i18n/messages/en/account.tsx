import type { ReactNode } from 'react';

export const account = {
  layout: {
    title: 'Account',
    tabAccount: 'Account',
    tabKeys: 'MCP keys',
  },
  documentTitle: 'Account',
  client: {
    unknown: 'Unknown client',
    unknownBrowser: 'Unknown browser',
    unknownPlatform: 'unknown platform',
    on: (browser: string, platform: string) => `${browser} on ${platform}`,
  },
  picture: {
    title: 'Picture',
    body: 'Shown wherever you appear — a member list, the history of a plan, your cursor on a canvas.',
    add: 'Add a picture',
    replace: 'Replace',
    modalTitle: 'Your picture',
  },
  avatarEditor: {
    unreadable: 'That file could not be read as an image.',
    zoom: 'Zoom',
    hint: (size: number) => `Drag the picture to move it. It is saved as a ${size}×${size} square.`,
    saving: 'Saving…',
    save: 'Save picture',
  },
  name: {
    title: 'Name',
    emailNote: (email: ReactNode) => (
      <>
        What the people you share a workspace with see. Your email is {email}; changing it needs
        email delivery, which is not built yet.
      </>
    ),
    label: 'Display name',
  },
  password: {
    title: 'Password',
    body: 'Changing it signs out every other session. If you are changing it because you think it leaked, that is the point.',
    current: 'Current password',
    new: 'New password',
    newHint: 'At least 10 characters.',
    changed: 'Password changed',
    change: 'Change password',
  },
  sessions: {
    title: 'Where you are signed in',
    body: 'End a session you do not recognise. This one stays.',
    endOthers: 'End the others',
    thisOne: 'this one',
    started: (when: string) => `Started ${when}`,
    end: 'End',
  },
  remove: {
    title: 'Delete your account',
    body: 'Everything you own goes with it: workspaces where you are the only owner, and every project and plan inside them. Export what you want to keep first.',
    button: 'Delete account',
    modalTitle: 'Delete your account',
    modalDescription: 'This cannot be undone. Confirm with your password.',
    password: 'Password',
    confirm: 'Delete my account',
  },
};
