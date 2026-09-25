/** Shared components and the helpers under lib/. */
export const ui = {
  author: {
    someone: 'Someone',
    via: (name: string) => ` · via ${name}`,
  },
  markdown: {
    task: 'task',
  },
  rowMenu: {
    actionsFor: (label: string) => `Actions for ${label}`,
  },
  notFound: {
    title: {
      page: 'There is no page here',
      plan: 'There is no plan here',
      sharedPlan: 'There is no shared plan here',
      project: 'There is no project here',
      folder: 'There is no folder here',
      workspace: 'There is no workspace here',
    },
    body: 'This address does not lead anywhere you can reach. It may never have existed, it may have been deleted, or it may belong to somebody who has not shared it with you.',
    back: 'Back to what you were working on',
  },
  api: {
    unreachable: (url: string) =>
      `Could not reach the server at ${url}. It may be offline, or this address may not be allowed to call it.`,
  },
};
