import base from './base.mjs';

export default [
  ...base,
  {
    files: ['**/*.tsx'],
    rules: {
      // React Flow re-mounts every node when nodeTypes/edgeTypes are rebuilt on
      // render. Those objects belong at module scope; see README performance notes.
      'no-restricted-syntax': [
        'warn',
        {
          // `:function` anchors this inside a component body. At module scope,
          // which is where these belong, it must not fire.
          selector:
            ':function VariableDeclarator[id.name=/^(nodeTypes|edgeTypes)$/] > ObjectExpression',
          message:
            'Declare nodeTypes/edgeTypes at module scope, not inside a component.',
        },
      ],
    },
  },
];
