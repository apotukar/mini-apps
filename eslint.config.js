import eslintPlugin from '@eslint/js';
import globals from 'globals';

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

    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      eqeqeq: 'warn',
      semi: ['error', 'always'],
      quotes: ['error', 'single']
    }
  }
];
