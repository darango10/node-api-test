const eslint = require('@eslint/js');
const security = require('eslint-plugin-security');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', '*.config.cjs', 'vitest.config.ts'],
  }
);
