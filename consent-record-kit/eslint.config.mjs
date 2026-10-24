import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.npm-cache/**', '.consumer/**'] },
  ...tseslint.configs.recommended,
  { files: ['test/**/*.mjs', 'scripts/**/*.mjs'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
