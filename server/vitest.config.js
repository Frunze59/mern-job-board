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
      // The brief measures coverage on new server code: controllers, models
      // and migrations. middleware is included too, since resolveOrg and
      // requireRole carry the permission rules.
      //
      // scripts/ is deliberately outside this set. seed-team.js has its own
      // tests, but bench-stats.js only runs against a live server, so counting
      // it here would report a number that says nothing about correctness.
      include: ['controllers/**', 'models/**', 'migrations/**', 'middleware/**'],
      // The brief's bar is 65%. These sit just under the current figures, so a
      // regression fails the run rather than quietly eroding toward the bar.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 88,
        branches: 90,
      },
    },
  },
});
