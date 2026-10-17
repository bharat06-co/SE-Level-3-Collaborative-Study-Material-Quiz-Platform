import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
  { ignores: ['**/node_modules/**', '**/coverage/**', '**/dist/**'] },
  js.configs.recommended,
  { files: ['**/*.{js,cjs,mjs,jsx}'], languageOptions: { ecmaVersion: 'latest', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.node, ...globals.browser } } },
  { files: ['**/*.test.{js,jsx}', '**/tests/**'], languageOptions: { globals: globals.jest } },
  { files: ['client/src/**/*.{js,jsx}'], plugins: { 'react-hooks': reactHooks }, rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' } },
  // JSX identifiers are consumed by React's automatic transform.
  { files: ['client/**/*.jsx'], rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]', argsIgnorePattern: '^_' }] } },
];
