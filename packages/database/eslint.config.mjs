import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      'no-console': 'warn',
    },
  },
  {
    files: ['src/seed*.ts', 'src/check-schema.ts', 'src/migrate-schema.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Ignore generated and config files
    ignores: ['dist/**', 'drizzle/**', '*.config.*'],
  }
);
