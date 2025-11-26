import eslintPlugin from '@eslint/js'
import globals from 'globals'

export default [
  // eslint:recommended aktivieren
  eslintPlugin.configs.recommended,

  {
    files: ['**/*.js'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      // Hier kommen die früheren envs hin
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022
      }
    },

    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': 'off',
      eqeqeq: 'warn',
      semi: ['error', 'never'],
      quotes: ['error', 'single']
    }
  }
]
