import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Client tests run in jsdom. They are kept in their own config rather than
 * added to vite.config.js, which reads server/.env to build the dev proxy and
 * has nothing to say about tests.
 *
 * The brief calls frontend tests welcome but not required, and points at the
 * invite-acceptance form. That is where these are aimed: it is the page with
 * the most branches and the only one a signed-out stranger can reach.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/**/*.test.jsx'],
  },
});
