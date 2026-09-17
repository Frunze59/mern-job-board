import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // mongodb-memory-server downloads a mongod binary on first run
    testTimeout: 30000,
    hookTimeout: 60000,
    // Tests share one in-memory database; run files one at a time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The brief measures coverage on NEW server code only.
      include: ['controllers/**', 'models/**', 'migrations/**', 'middleware/**'],
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 65,
        branches: 60,
      },
    },
  },
});
