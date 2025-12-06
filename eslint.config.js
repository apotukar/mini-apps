import eslintPlugin from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['**/*.min.js']
  },

  eslintPlugin.configs.recommended,

  {
    files: ['**/*.js'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022
      }
    },

    plugins: {
      import: importPlugin
    },

    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.cjs', '.json']
        }
      },
      'import/core-modules': ['webdav']
    },

    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      curly: ['error', 'all'],
      eqeqeq: 'warn',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],

      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/no-duplicates': 'warn',
      'import/no-cycle': 'warn'
    }
  }
];
