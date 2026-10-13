import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'commitlint.config.js',
      'postcss.config.mjs',
    ],
  },

  // Registers the react, react-hooks, import, jsx-a11y and @next plugins.
  ...nextCoreWebVitals,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Config files live outside tsconfig's include, but still get linted.
        projectService: { allowDefaultProject: ['*.mjs', '*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      // The design-system wrappers are the controls a <label> wraps.
      'jsx-a11y': {
        components: { Input: 'input', Textarea: 'textarea', Select: 'select', Checkbox: 'input' },
      },
    },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // A form listens for its fields' changes and blurs (event delegation) to
      // check them as they are filled in; the fields themselves stay the controls.
      'jsx-a11y/no-noninteractive-element-interactions': [
        'error',
        {
          body: ['onError', 'onLoad'],
          iframe: ['onError', 'onLoad'],
          img: ['onError', 'onLoad'],
          form: ['onChange', 'onBlur'],
        },
      ],
      'jsx-a11y/label-has-associated-control': [
        'error',
        { controlComponents: ['Checkbox', 'Input', 'Select', 'Textarea'], depth: 3 },
      ],

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // A leading underscore marks a binding that exists only to be discarded.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // `type` throughout: consistency matters more than the type-vs-interface choice.
      '@typescript-eslint/consistent-type-definitions': 'off',
      // `onClick={() => doSomething()}` is the normal React shape.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],

      'import/no-cycle': ['error', { maxDepth: 6 }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    files: ['scripts/**/*.ts', 'e2e/**/*.ts', '*.config.{ts,mjs,js}'],
    rules: { 'no-console': 'off' },
  },

  {
    // The plugins this file composes ship untyped exports.
    files: ['eslint.config.mjs'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  {
    // The service worker runs in a worker scope, not the page.
    // Plain JavaScript run as-is (service worker, mongo shell), so there are no types to use.
    files: ['public/sw.js', 'deploy/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { self: 'readonly', caches: 'readonly', db: 'readonly', process: 'readonly' },
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },

  prettier,
);
