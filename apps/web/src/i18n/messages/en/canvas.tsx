export const canvas = {
  canvas: {
    menu: {
      addNode: 'Add node here',
      tidyUp: 'Tidy up',
      duplicate: 'Duplicate',
      noteOnNode: 'Leave a note on this node',
      noteHere: 'Leave a note here',
      groupNodes: (count: number) => (count === 1 ? 'Group 1 node' : `Group ${count} nodes`),
      takeOutOf: (box: string) => `Take out of ${box}`,
      takeOutOfBox: 'Take out of the box',
      standardWidth: 'Use the standard width',
      deleteNode: 'Delete node',
      deleteConnection: 'Delete connection',
      undo: 'Undo',
      redo: 'Redo',
      fitPlan: 'Fit the whole plan',
      gridSpacing: 'Grid spacing',
      gridStep: (step: number) => `${step} px`,
      snapBy: 'Snap by',
      snapTerminals: 'Terminals',
      snapOuterEdge: 'Outer edge',
      hideResolved: (count: number) =>
        count === 1 ? 'Hide 1 resolved note' : `Hide ${count} resolved notes`,
      showResolved: (count: number) =>
        count === 1 ? 'Show 1 resolved note' : `Show ${count} resolved notes`,
    },
    grid: {
      snap: 'Snap to the grid',
      stopSnapping: 'Stop snapping to the grid',
      snappingTo: (step: number) => `Snapping to a ${step}px grid`,
      notSnapping: 'Not snapping to the grid',
    },
    card: {
      untitled: 'Untitled',
      title: 'Node title',
    },
    spacing: {
      handle: 'Drag to change the spacing',
    },
    paste: {
      notLoaded:
        "This project's statuses and kinds have not loaded yet, so nothing was pasted. Try again in a moment.",
      wordsRefused:
        'The copied statuses and kinds could not be added to this project, so nothing was pasted.',
    },
    readingFrom: (by: string, from: string) => `${by} is reading from ${from}`,
  },
};
