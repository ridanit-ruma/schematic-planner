import type { ReactNode } from 'react';

const count = (n: number, one: string, many: string): string =>
  n === 1 ? `1 ${one}` : `${n} ${many}`;

export const workspaces = {
  /** A role's display name. The enum value sent to the API stays as it is. */
  roles: {
    OWNER: 'owner',
    ADMIN: 'admin',
    EDITOR: 'editor',
    VIEWER: 'viewer',
  },
  /** Words the remaining tables and their row menus share. */
  list: {
    actions: 'Actions',
    moveToTrash: 'Move to trash',
    confirmTrash: (name: string) => `Move ${name} to the trash?`,
  },
  projects: {
    trashBody: 'The plans inside go with it. You can bring the whole project back from the trash.',
  },
  projectSettings: {
    title: 'Project settings',
    description: 'What this project is called, and what happens to it.',
    name: {
      title: 'Name',
      body: 'The address stays as it is — a link somebody saved should survive a change of mind about the name.',
      label: 'Project name',
      description: 'Description',
    },
    delete: {
      title: 'Delete this project',
      body: 'It goes to the trash with the plans it holds, and restoring it brings back exactly what was under it.',
    },
  },
  settings: {
    title: 'Workspace settings',
    name: {
      title: 'Name',
      body: (slug: ReactNode) => (
        <>
          The address stays {slug} — a link somebody saved should survive a change of mind about the
          name.
        </>
      ),
      label: 'Workspace name',
    },
    delete: {
      title: 'Delete this workspace',
      body: (workspace: string) =>
        `Every project, plan and API key in ${workspace} goes with it, for everybody. Export anything you want to keep first — the export needs nothing from this service to be readable.`,
      action: 'Delete workspace',
      confirmTitle: (workspace: string) => `Delete ${workspace}`,
      confirmBody: 'This cannot be undone. Type the workspace name to confirm.',
      typeName: (workspace: string) => `Type "${workspace}"`,
    },
  },
  members: {
    title: 'Members',
    description: (workspace: string) => `Everyone who can open ${workspace}.`,
    invite: 'Invite someone',
    empty: {
      title: 'Nobody here',
      body: 'That should not be possible — a workspace keeps an owner.',
    },
    person: 'Person',
    role: 'Role',
    you: 'you',
    roleHelp: {
      VIEWER: 'Can read plans and export them.',
      EDITOR: 'Can draw, and can create keys for agents.',
      ADMIN: 'Can also invite people and change roles.',
      OWNER: 'Can also delete the workspace.',
    },
    invitations: {
      title: 'Open invitations',
      body: 'Links that would still let somebody in. A spent or expired one is not listed; withdrawing one stops it working immediately.',
      link: 'Link',
      role: 'Role',
      expires: 'Expires',
      issuedEarlier: 'issued earlier',
      by: (name: string) => `by ${name}`,
      withdraw: 'Withdraw',
    },
    inviteModal: {
      title: 'Invite someone',
      description: 'Creates a link. Anyone who opens it joins this workspace at the role you pick.',
      role: 'Role',
      submit: 'Create link',
      expiry: 'The link expires in 14 days. There is no email yet, so send it yourself.',
      copy: 'Copy',
    },
  },
  invite: {
    documentTitle: 'Invitation',
    invitedYou: (inviter: ReactNode) => <>{inviter} invited you to</>,
    asRole: {
      OWNER: (role: ReactNode) => (
        <>As {role}, so you can run the workspace, including deleting it.</>
      ),
      ADMIN: (role: ReactNode) => <>As {role}, so you can manage members and projects.</>,
      EDITOR: (role: ReactNode) => <>As {role}, so you can draw on every plan in it.</>,
      VIEWER: (role: ReactNode) => <>As {role}, so you can read every plan in it.</>,
      other: (role: ReactNode) => <>As {role}, so you can take part in it.</>,
    },
    settled: {
      accepted: (inviter: string) =>
        `This invitation has already been used. Ask ${inviter} for a new one.`,
      declined: (inviter: string) =>
        `This invitation was turned down. Ask ${inviter} for a new one.`,
      expired: (inviter: string) => `This invitation has expired. Ask ${inviter} for a new one.`,
    },
    alreadyMember: 'You are already in this workspace.',
    open: (workspace: string) => `Open ${workspace}`,
    signInToAccept: 'Sign in to accept',
    createAccount: 'Create an account',
    otherAddress: (invited: ReactNode, signedIn: ReactNode) => (
      <>
        This was sent to {invited}, and you are signed in as {signedIn}. Accepting joins the account
        you are signed in as.
      </>
    ),
    accept: 'Accept',
    decline: 'Decline',
    signedInAs: (email: string) => `Signed in as ${email}`,
  },
  trash: {
    title: 'Trash',
    description:
      'Deleted plans and projects wait here. Nothing leaves on its own — restore it, or remove it for good.',
    emptyTrash: 'Empty trash',
    empty: {
      title: 'Nothing in the trash',
      body: 'Deleted plans and projects appear here instead of disappearing.',
    },
    item: 'Item',
    wasIn: 'Was in',
    deleted: 'Deleted',
    kinds: {
      plan: 'plan',
      project: 'project',
      folder: 'folder',
    },
    shared: 'shared',
    by: (name: string) => `by ${name}`,
    restore: 'Restore',
    stopSharing: 'Stop sharing',
    deleteForGood: 'Delete for good',
    purge: {
      title: (name: string) => `Delete ${name} for good?`,
      project: 'The project and every plan inside it go with it. This cannot be undone.',
      folder:
        'The folder goes; the plans in it return to the top of the project. This cannot be undone.',
      plan: 'The plan, its history and its share link go with it. This cannot be undone.',
    },
    emptyModal: {
      title: 'Empty the trash?',
      body: (items: number) =>
        `${count(items, 'item', 'items')} will be removed for good. This cannot be undone.`,
    },
  },
};
