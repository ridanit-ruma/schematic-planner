import type { ReactNode } from 'react';

export const plan = {
  labels: {
    nodeKind: {
      feature: 'Feature',
      task: 'Task',
      decision: 'Decision',
      note: 'Note',
      group: 'Group',
    },
    status: {
      idea: 'Idea',
      planned: 'Planned',
      in_progress: 'In progress',
      blocked: 'Blocked',
      done: 'Done',
      dropped: 'Dropped',
    },
    edgeKind: {
      flows_to: 'Flows to',
      depends_on: 'Depends on',
      contains: 'Contains',
      relates_to: 'Relates to',
    },
    edgeMeaning: {
      flows_to: 'Control or data moves this way. A reply is its own flow, pointing back.',
      depends_on: 'Orders the two. Becomes the number on each filename when you export.',
      contains: 'Nests one inside the other. Becomes a directory when you export.',
      relates_to: 'A plain association. Carries no structure.',
    },
  },
  inspector: {
    title: 'Title',
    identifier: 'Identifier',
    identifierClash: 'Another node already answers to that',
    identifierMalformed: 'Lowercase words joined by single hyphens',
    identifierHint: 'How an agent addresses this node, and the file it exports to',
    kind: 'Kind',
    status: 'Status',
    tags: 'Tags',
    tagsHint: 'Separated by commas',
    detail: 'Detail',
    nothingYet: 'Nothing yet',
    deleteNode: 'Delete node',
    deleteNodeNote: 'Removes the node and every connection attached to it.',
    due: 'Due',
  },
  edgeInspector: {
    connection: 'Connection',
    meaning: 'Meaning',
    setOffBy: 'Set off by',
    setOffByHint: 'What starts it: a click, a route, a request, a timer.',
    setOffByPlaceholder: 'click Sign in',
    carries: 'Carries',
    carriesHint: 'What travels along it: a payload, a record, a return value.',
    label: 'Label',
    labelHint: 'Drawn on the line. Optional.',
    straighten: 'Straighten',
    removeConnection: 'Remove connection',
    leaves: 'Leaves from',
    arrives: 'Arrives at',
    sidesHint:
      'A line with a chosen side is drawn square between them and cannot be bent. Automatic gives the bends back.',
    sides: { auto: 'Automatic', top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' },
  },
  history: {
    title: 'History',
    empty: 'Nothing yet. Every change to this plan is recorded here, whoever makes it.',
    fewer: 'Fewer',
    eachOne: 'Each one',
    /** Who did it, then what they did. */
    entry: (author: ReactNode, line: string) => (
      <>
        {author} {line}
      </>
    ),
    /** Stands in for the subject when a change to the plan itself carries no name. */
    thisPlan: 'this plan',
    /** The value a status change ended on, keyed by the status. */
    statusWord: {
      idea: 'idea',
      planned: 'planned',
      in_progress: 'in_progress',
      blocked: 'blocked',
      done: 'done',
      dropped: 'dropped',
    } as Record<string, string>,
    /** The value a kind change ended on, keyed by the kind. */
    kindWord: {
      feature: 'feature',
      task: 'task',
      decision: 'decision',
      note: 'note',
      group: 'group',
    } as Record<string, string>,
    change: {
      planCreated: (nodes: string | null) =>
        nodes === null ? 'started this plan' : `started this plan with ${nodes} nodes`,
      planTitle: (name: string) => `renamed the plan to ${name}`,
      planDescription: 'wrote the plan description',
      planArranged: (count: string | null) =>
        count === null
          ? 'moved some nodes'
          : count === '1'
            ? 'moved 1 node'
            : `moved ${count} nodes`,
      nodeAdded: (name: string) => `added ${name}`,
      nodeRemoved: (name: string) => `removed ${name}`,
      nodeIdentifier: (name: string, slug: string) => `now addresses ${name} as ${slug}`,
      nodeRenamed: (from: string | null, name: string) => `renamed ${from ?? 'a node'} to ${name}`,
      nodeStatus: (name: string, status: string | null) =>
        `set ${name} to ${status ?? 'a new state'}`,
      nodeKind: (name: string, kind: string | null) => `made ${name} a ${kind ?? 'different kind'}`,
      nodeBody: (name: string) => `wrote in ${name}`,
      nodeTagsCleared: (name: string) => `cleared the tags on ${name}`,
      nodeTags: (name: string, tags: string) => `tagged ${name} ${tags}`,
      nodeMetaCleared: (name: string) => `cleared the extra fields on ${name}`,
      nodeMeta: (name: string, fields: string) => `set ${fields} on ${name}`,
      edgeAdded: (name: string) => `connected ${name}`,
      edgeRemoved: (name: string) => `disconnected ${name}`,
      noteAdded: (name: string) => `left a note on ${name}`,
      noteRemoved: (name: string) => `removed the note on ${name}`,
      noteEdited: (name: string) => `rewrote the note on ${name}`,
      noteAnswered: (name: string) => `answered the note on ${name}`,
      noteResolved: (name: string) => `resolved the note on ${name}`,
      noteReopened: (name: string) => `reopened the note on ${name}`,
      other: (name: string) => `changed ${name}`,
    },
    /** A folded batch, counted: `+41 nodes, +62 connections`. `change` is the signed counts. */
    summary: {
      nodes: (change: string, total: number) =>
        total === 1 ? `${change} node` : `${change} nodes`,
      connections: (change: string, total: number) =>
        total === 1 ? `${change} connection` : `${change} connections`,
      notes: (change: string, total: number) =>
        total === 1 ? `${change} note` : `${change} notes`,
      edits: (count: number) => (count === 1 ? '1 edit' : `${count} edits`),
      separator: ', ',
      madeChanges: 'made some changes',
    },
  },
  comments: {
    someone: 'Someone',
    placeholder: 'What about this?',
    empty: 'Empty note',
    reopen: 'Reopen',
    resolve: 'Resolve',
    deleteNote: 'Delete note',
  },
  views: {
    switchView: 'View',
    canvas: 'Canvas',
    table: 'Table',
    board: 'Board',
    otherStatuses: 'Other statuses',
    empty: 'No nodes yet',
    unsaved: 'Unsaved view',
    edited: 'edited',
    saveChanges: 'Save changes',
    saveAs: 'Save as a new view…',
    deleteView: 'Delete this view',
    filter: 'Filter',
    clearFilter: 'Clear filter',
    noTags: 'No tags yet',
    search: 'Find in titles and detail',
    saveTitle: 'Save this view',
    saveDescription: 'Everyone in the project sees the views saved here.',
    viewName: 'Name',
    noMatch: 'Nothing matches this filter',
    filterCount: (count: number) => `Filter · ${count}`,
    timeline: 'Timeline',
    matrix: 'Matrix',
    noDate: 'No date',
    noTag: 'No tag',
    rows: 'Rows',
    columns: 'Columns',
  },
  diagnostics: {
    title: 'Checks',
    open: 'Check the plan',
    hide: 'Hide checks',
    clean: (checked: number) =>
      `Nothing to report. Checked ${checked} ${checked === 1 ? 'node or edge' : 'nodes and edges'}.`,
    severity: { error: 'Error', warning: 'Warning', info: 'Note' },
    rules: {
      dependencyCycle: (names: string) =>
        `Dependency cycle: ${names}. None of these can be started first.`,
      isolatedNode: (name: string) => `“${name}” is connected to nothing.`,
      outsideFlow: (name: string) => `“${name}” is work outside every flow.`,
      unknownKind: (name: string, kind: string) =>
        `“${name}” has the kind “${kind}”, which this project does not define.`,
      unknownStatus: (name: string, status: string) =>
        `“${name}” has the status “${status}”, which this project does not define.`,
    },
  },
  sources: {
    title: 'Sources',
    open: 'Sources',
    hide: 'Hide sources',
    from: 'Written from',
    into: 'Written into',
    noneFrom: 'This plan names no source. An agent sets them with set_plan_sources.',
    noneInto: 'No plan names this one as its source.',
    gone: 'A deleted plan',
    state: { missing: 'Missing', moved: 'In another project' },
  },
  versions: {
    title: 'Versions',
    open: 'Versions',
    hide: 'Hide versions',
    save: 'Save',
    labelHint: 'Name this version (optional)',
    saved: 'Saved',
    beforeAgent: "Before an agent's change",
    beforeRestore: 'Before a restore',
    restore: 'Restore',
    restoreTitle: 'Restore this version?',
    restoreDescription:
      'The plan goes back to how it was then, for everyone. How it is now is kept as a version first, so this can be undone.',
    empty:
      'None yet. One is kept before every change an agent makes, and whenever somebody saves one.',
  },
  titleBlock: {
    planSettings: 'Plan settings',
    nextNote: 'Go to the next open note',
    addNode: 'Add node',
    planActions: 'Plan actions',
    arrange: 'Arrange',
    share: 'Share',
    history: 'History',
    hideHistory: 'Hide history',
    export: 'Export',
    onlyYou: 'Only you are here',
    peopleHere: (count: number) => (count === 1 ? '1 person here' : `${count} people here`),
    you: 'you',
    nodeCount: (count: number) => (count === 1 ? '1 node' : `${count} nodes`),
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Not connected — changes are local until this reconnects',
  },
  page: {
    untitled: 'Untitled plan',
    shareTitle: 'Share this plan',
    shareDescription:
      'Anyone with this link can read the plan and download the export. They cannot change it.',
    stopSharing: 'Stop sharing',
    copyLink: 'Copy link',
  },
  settings: {
    title: 'Plan settings',
    description: 'Everything about this plan except the drawing.',
    openCanvas: 'Open the canvas',
    name: {
      title: 'Name',
      description: 'What it is called in every list, and on the canvas.',
      titleField: 'Title',
      descriptionField: 'Description',
      descriptionHint: 'One line, shown under the title in a list.',
    },
    location: {
      title: 'Where it lives',
      description: 'A plan keeps its address when it moves, so every link to it survives.',
      workspace: 'Workspace',
      project: 'Project',
      noProject: 'That workspace has no project to put it in.',
      leaving: (workspace: string) =>
        `Moving it out of ${workspace} takes it away from everyone there, and drops its share link — that link was handed out on the understanding of who could reach the plan.`,
      move: 'Move it',
    },
    trash: {
      title: 'Delete this plan',
      description: 'It goes to the workspace trash, where it can be restored or removed for good.',
      moveToTrash: 'Move to trash',
      confirmTitle: (title: string) => `Move ${title} to the trash?`,
      confirmDescription:
        'It stops appearing everywhere it is listed. You can bring it back from the trash.',
    },
    in: (workspace: ReactNode) => <>In {workspace}.</>,
  },
  shared: {
    goHome: 'Go to Schematic Planner',
    readOnly: 'Read only',
    export: 'Export',
  },
  group: {
    /** What a group is called before anybody names it. */
    defaultTitle: 'Group',
  },
};
