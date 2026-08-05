import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Neutralino.js injects this global at runtime (via __neutralino_globals.js)
        Neutralino: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // React 17+ JSX transform doesn't need React in scope
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Warn on unused vars (prefix with _ to ignore)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Allow console.warn and console.error only
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // React Hooks rules
      ...hooksPlugin.configs.recommended.rules,
      // Warn if exitProcessOnClose is false — patched binary handles close directly
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Property[key.name="exitProcessOnClose"][value.value=false]',
          message: 'exitProcessOnClose is set to false. With the patched binary (dispatch_async fix), setting it to true provides more reliable close behavior.',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    ignores: [
      'dist/',
      '.vite/',
      'node_modules/',
      'src/assets/',
    ],
  },
];
