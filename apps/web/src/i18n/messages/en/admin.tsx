import type { ReactNode } from 'react';

export const admin = {
  layout: {
    title: 'Instance',
    body: 'Everything about this deployment rather than about one workspace.',
    tabUsage: 'Usage',
    tabInvitations: 'Invitations',
    tabPeople: 'People',
  },
  actions: 'Actions',
  invitations: {
    documentTitle: 'Invitations',
    intro:
      'A link lets somebody make an account here. Give one to a person rather than a code to everybody: it can be limited, withdrawn, and told apart afterwards.',
    newLink: 'New link',
    code: {
      title: 'The sign-up code',
      body: (variable: ReactNode) => (
        <>
          Set in this deployment&rsquo;s configuration. Anyone who has it can make an account
          without a link, as many times as they like, and nothing here records that they did. Clear{' '}
          {variable} to take this door away.
        </>
      ),
    },
    copied: 'Copied',
    copy: 'Copy',
    empty: {
      noneOpen: 'No invitations still open',
      noneYet: 'No invitations yet',
      noCode: 'Nobody can sign up until you issue a link.',
      onlyCode: 'The code above is the only way in at the moment.',
    },
    columns: {
      invitation: 'Invitation',
      used: 'Used',
      expires: 'Expires',
      state: 'State',
    },
    untitled: 'Untitled',
    byline: (prefix: string, by: string) => `${prefix}… · by ${by}`,
    uses: (uses: number, max: number | null) => (max === null ? `${uses}` : `${uses} of ${max}`),
    never: 'Never',
    states: {
      live: 'live',
      usedUp: 'used up',
      expired: 'expired',
      withdrawn: 'withdrawn',
    },
    thisInvitation: 'this invitation',
    withdraw: 'Withdraw',
    hideSpent: 'Hide what is no longer open',
    showSpent: (count: number) =>
      `${count === 1 ? '1 invitation' : `${count} invitations`} no longer open — show`,
    create: {
      title: 'New invitation',
      label: 'What it is for',
      labelHint: 'Only you see this. It is how you tell links apart.',
      labelPlaceholder: 'For the design review',
      limit: 'How many accounts',
      life: 'How long it lasts',
      submit: 'Issue link',
    },
    limits: {
      one: 'One person',
      five: 'Up to five',
      twentyFive: 'Up to twenty-five',
      none: 'No limit',
    },
    lives: {
      day: 'A day',
      week: 'A week',
      fortnight: 'A fortnight',
      threeMonths: 'Three months',
      forever: 'Until withdrawn',
    },
    issued: {
      title: 'The link',
      description:
        'Copy it now. Only its hash is kept, so it cannot be shown again — issue another if it is lost.',
      copy: 'Copy link',
    },
    remove: {
      title: 'Delete this invitation?',
      withAccounts: (count: number) =>
        `${count === 1 ? '1 account' : `${count} accounts`} came in through it and will stop saying how they got here. Withdrawing it instead stops it working and keeps that.`,
      withoutAccounts:
        'It will stop working and be forgotten. Withdrawing it instead keeps the record.',
    },
  },
  people: {
    documentTitle: 'People',
    columns: {
      account: 'Account',
      holds: 'Holds',
      joined: 'Joined',
      lastChange: 'Last change',
    },
    owner: 'owner',
    suspended: 'suspended',
    via: (label: string) => `via ${label}`,
    viaInvitation: 'via an invitation',
    holds: (workspaces: number, plans: number, keys: number) =>
      [
        workspaces === 1 ? '1 workspace' : `${workspaces} workspaces`,
        plans === 1 ? '1 plan' : `${plans} plans`,
        ...(keys > 0 ? [keys === 1 ? '1 key' : `${keys} keys`] : []),
      ].join(' · '),
    withdrawOwnership: 'Withdraw ownership',
    makeOwner: 'Make an owner',
    suspend: 'Suspend',
    letBackIn: 'Let back in',
    you: 'you',
    signedInAs: (who: ReactNode) => (
      <>
        Signed in as {who}. An account is suspended rather than deleted, so what it drew stays
        attributed to somebody.
      </>
    ),
    suspendTitle: (name: string) => `Suspend ${name}?`,
    suspendDescription:
      'They are signed out everywhere immediately and cannot sign in again. Their workspaces, plans and history stay exactly as they are.',
  },
  usage: {
    documentTitle: 'Usage',
    openPlans: 'Open plans',
    connections: 'Connections',
    rightNow: 'right now',
    signedIn: 'Signed in',
    activeIn: (active: number, days: number) => `${active} active in ${days}d`,
    accounts: 'Accounts',
    newAndSuspended: (joined: number, suspended: number) =>
      `${joined} new · ${suspended} suspended`,
    newIn: (joined: number, days: number) => `${joined} new in ${days}d`,
    drawn: {
      title: 'What has been drawn',
      plans: 'Plans',
      inTrash: (count: number) => `${count} in the trash`,
      nodes: 'Nodes',
      nodesPerPlan: (count: number) => `${count} a plan on average`,
      connections: 'Connections',
      largestPlan: 'Largest plan',
      nodeCount: (count: number) => (count === 1 ? '1 node' : `${count} nodes`),
      workspaces: 'Workspaces',
      projectCount: (count: number) => (count === 1 ? '1 project' : `${count} projects`),
    },
    agents: {
      title: 'Agents',
      keysInUse: 'Keys in use',
      revoked: (count: number) => `${count} revoked`,
      changesByAgents: 'Changes by agents',
      shareOfEverything: (percent: number) => `${percent}% of everything`,
      shareLinks: 'Share links',
      invitationsOpen: 'Invitations open',
      database: 'Database',
      lastUsed: 'Last used',
    },
    busiest: {
      title: 'Busiest workspaces',
      changeCount: (count: number) => (count === 1 ? '1 change' : `${count} changes`),
      planCount: (count: number) => (count === 1 ? '1 plan' : `${count} plans`),
    },
    trend: {
      title: (days: number) => `Changes over ${days} days`,
      aside: (changes: number, days: number) =>
        `${changes} in the last ${days === 1 ? '1 day' : `${days} days`}`,
      byAgents: (count: number) => `${count} by agents`,
      byPeople: (count: number) => `${count} by people`,
      people: 'people',
      agents: 'agents',
      peak: (count: number) => `peak ${count}`,
    },
  },
};
