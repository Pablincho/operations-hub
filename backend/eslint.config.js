import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['**/*.{js,cjs}'],
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/migrations/**/*.cjs'],
    rules: { 'no-unused-vars': 'off' }
  }
];
