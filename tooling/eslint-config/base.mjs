import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Build output. `out/**` is where a Next export lands, and linting a
    // minified chunk reports two thousand problems in code nobody wrote.
    ignores: [
      'dist/**',
      'build/**',
      'out/**',
      '.next/**',
      '.turbo/**',
      'coverage/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    /*
     * Plain JavaScript here is not library code: it is the build and check
     * scripts, and the runtime config shim the browser loads. They run in Node
     * or in a page, and `no-undef` has no type information to tell it which —
     * which is why typescript-eslint turns the rule off for TypeScript and why
     * every one of these files failed it. Named rather than pulled from the
     * `globals` package, so the list says what these files are allowed to
     * assume instead of granting two whole environments.
     */
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        MouseEvent: 'readonly',
        URL: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        getComputedStyle: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Dependencies must flow packages -> apps, never the reverse.
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/apps/**'], message: 'packages must not import from apps' }] },
      ],
    },
  },
);
