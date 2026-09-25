export const agents = {
  documentTitle: 'Agents',
  intro:
    'Connect Cursor, Claude, or any other MCP client. A key belongs to you rather than to one workspace, so a single key reaches every workspace you are a member of — the agent can read your plans and draw new ones on the same canvas you are looking at.',
  server: {
    title: 'Server URL',
    body: 'The same for everyone on this instance. Pair it with a key below.',
  },
  keys: {
    title: 'Keys',
    body: 'A key acts as you, everywhere you are a member. Revoke one and it stops working immediately.',
    newKey: 'New key',
    empty: {
      title: 'No keys yet',
      body: 'Create one to connect your first agent.',
    },
    columns: {
      name: 'Name',
      key: 'Key',
      lastUsed: 'Last used',
      actions: 'Actions',
    },
    neverUsed: 'never used',
    never: 'Never',
    limitedTo: (scope: string) => `limited to ${scope}`,
    revoke: 'Revoke',
  },
  create: {
    title: 'New key',
    name: 'Name',
    nameHint: 'Something that says which machine or tool holds it.',
    namePlaceholder: 'Cursor on my laptop',
    submit: 'Create key',
  },
  issued: {
    title: 'Copy your key now',
    description: 'This is the only time it is shown. The server keeps a hash, not the key.',
    configTitle: 'Configuration for an MCP client',
    configBody:
      "Paste it into the client's MCP settings. Copying this is the whole of the setup — there is nothing to install.",
  },
  copyConfiguration: 'Copy configuration',
  copy: 'Copy',
};
