/** The workbench around every screen: the rail, the account menu and the bar above the pane. */
export const shell = {
  account: {
    menu: 'Account',
    you: 'You',
    settings: 'Account settings',
    agentKeys: 'Agent keys',
    instance: 'Instance',
    signOut: 'Sign out',
  },
  workspaceSwitcher: {
    label: (name: string) => `${name} — switch workspace`,
    newWorkspace: 'New workspace',
    name: 'Name',
    hint: 'A workspace holds projects, and a project holds plans.',
    placeholder: 'Acme',
    create: 'Create workspace',
  },
};
