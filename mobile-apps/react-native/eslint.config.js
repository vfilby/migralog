const typescriptParser = require('@typescript-eslint/parser');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactNativePlugin = require('eslint-plugin-react-native');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'coverage/**',
      'e2e/artifacts/**',
      '**/*.config.js',
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        __DEV__: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        alert: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      'react': reactPlugin,
      'react-native': reactNativePlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // React
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'off', // Disabled: false positives with createStyles(theme) pattern
      'react-native/no-inline-styles': 'off', // Disabled: intentional for conditional styling
      'react-native/no-color-literals': 'off',

      // General
      'no-console': 'warn', // Warn on direct console usage - use logger utility instead
      'no-debugger': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Test file overrides - relax some rules for test code
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    rules: {
      // Allow 'any' type in tests for mocking purposes
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow console statements in tests (for testing console output and debugging)
      'no-console': 'off',
      // Allow unused variables in catch blocks (common in error assertions)
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none' // Don't warn about unused catch variables
      }],
    },
  },
  // E2E test overrides - allow console statements for debugging
  {
    files: ['e2e/**/*.{js,ts}', 'scripts/**/*.{js,ts}'],
    rules: {
      // Allow 'any' type in E2E tests for mocking
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow console statements in E2E tests (debugging)
      'no-console': 'off',
      // Allow unused variables in catch blocks
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
    },
  },
];
