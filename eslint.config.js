import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Modules that must stay headless and deterministic (see docs/04_architecture.md §2).
const PURE = ['src/sim/**/*.ts', 'src/gen/**/*.ts', 'src/data/**/*.ts', 'src/core/**/*.ts'];
const PURE_EXCEPT = ['src/core/save.ts']; // the only core file allowed to touch IndexedDB / wall clock

const browserGlobals = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'HTMLElement', 'fetch'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: PURE,
    ignores: PURE_EXCEPT,
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'three', message: 'sim/gen/core/data must not depend on Three.js.' },
          { name: 'preact', message: 'sim/gen/core/data must not depend on Preact.' },
        ],
        patterns: [
          { group: ['three/*', 'preact/*'], message: 'sim/gen/core/data must not depend on rendering/UI libraries.' },
          { group: ['**/render/**', '**/ui/**', '**/input/**', '**/audio/**'], message: 'sim/gen/core/data must not import render/ui/input/audio.' },
        ],
      }],
      'no-restricted-globals': ['error', ...browserGlobals.map((name) => ({ name, message: 'No DOM/browser globals in sim/gen/core/data.' }))],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Use core/rng.ts (seeded, state-backed).' },
        { object: 'Date', property: 'now', message: 'Sim time comes from state.time, not the wall clock.' },
      ],
      'no-restricted-syntax': ['error',
        { selector: "NewExpression[callee.name='Date']", message: 'No wall clock in sim/gen/core/data.' },
      ],
    },
  },
);
