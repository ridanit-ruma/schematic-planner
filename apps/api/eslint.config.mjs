import base from '@schematic/eslint-config/base';

export default [
  { ignores: ['src/generated/**'] },
  ...base,
  {
    rules: {
      // Nest resolves dependencies from the metadata `emitDecoratorMetadata`
      // writes for constructor parameter types. That metadata is a runtime
      // reference, but the rule cannot see it and would rewrite those imports to
      // `import type`, erasing them and breaking injection at startup.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
