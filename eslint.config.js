const pluginSecurity = require('eslint-plugin-security');

module.exports = [
  pluginSecurity.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  },
  {
    // cliente del navegador
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        DOMParser: 'readonly'
      }
    }
  },
  {
    ignores: ['node_modules/**', 'sbom.json', 'playwright-report/**', 'test-results/**']
  }
];
