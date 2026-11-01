// eslint.config.js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const namingConvention = [
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
  { selector: 'variable', modifiers: ['destructured'], format: null },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['PascalCase'] },
  {
    selector: ['objectLiteralProperty', 'typeProperty'],
    modifiers: ['requiresQuotes'],
    format: null,
  },
];

const hubContexts = [
  'account',
  'admin',
  'auth',
  'auth-session',
  'browser-session',
  'job',
  'product',
  'proxy',
];
const hubUnits = [...hubContexts, 'shared'];
const frameworks = ['@nestjs/*', 'bullmq', 'ioredis', '**/generated/**'];
const hubLayerPatterns = {
  domain: ['**/application/**', '**/infrastructure/**', '**/presentation/**', ...frameworks],
  application: ['**/infrastructure/**', '**/presentation/**', ...frameworks],
  infrastructure: ['**/presentation/**'],
  presentation: ['**/infrastructure/**'],
};

// A context reaches another one only through its application barrel, and its module to wire it;
// the domain of a context and shared reach none. The files are excluded one level at a time: a file
// cannot be let back in once its directory is excluded.
const hubContextPatterns = (unit, layer) =>
  hubContexts
    .filter((context) => context !== unit)
    .flatMap((context) =>
      unit === 'shared' || layer === 'domain'
        ? [`**/${context}/**`]
        : [
            `**/${context}/domain/**`,
            `**/${context}/infrastructure/**`,
            `**/${context}/presentation/**`,
            `**/${context}/application/*.js`,
            `!**/${context}/application/index.js`,
            `**/${context}/*.js`,
            `!**/${context}/${context}.module.js`,
          ],
    );

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      'apps/frontend-*/src/shared/api/schema.d.ts',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },

  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/naming-convention': ['error', ...namingConvention],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': 'error',
      // Nest modules are empty classes configured by their decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },

  // The layers of a hub context and the contexts among themselves. Tests wire the in-memory
  // adapters of the neighbour contexts as test doubles.
  ...hubUnits.flatMap((unit) => [
    {
      files: [`apps/hub/src/${unit}/*.ts`],
      ignores: ['**/*.test.ts'],
      rules: {
        'no-restricted-imports': ['error', { patterns: hubContextPatterns(unit, 'module') }],
      },
    },
    ...Object.entries(hubLayerPatterns).map(([layer, patterns]) => ({
      files: [`apps/hub/src/${unit}/${layer}/**/*.ts`],
      ignores: ['**/*.test.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: [...hubContextPatterns(unit, layer), ...patterns] },
        ],
      },
    })),
  ]),

  {
    // What the providers send and expect is snake_case, Prisma queries say `OR` and `AND`, and the S3 commands take `Bucket` and `Key`: those names are theirs.
    files: [
      'apps/hub/src/auth/infrastructure/*.ts',
      'apps/hub/src/*/infrastructure/prisma-*.ts',
      'apps/hub/src/shared/infrastructure/s3-*.ts',
      'apps/hub/src/e2e/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...namingConvention,
        { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
      ],
    },
  },

  {
    // The panel runs in a browser, and its components are named in PascalCase.
    files: ['apps/frontend-*/**/*.{ts,tsx}', 'packages/frontend-shared/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...namingConvention,
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
      ],
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  eslintConfigPrettier,
);
