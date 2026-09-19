import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

/**
 * Each test starts from an empty browser: no rendered tree, and no session
 * left in localStorage. The accept page branches on exactly that, so a leak
 * between tests would quietly change which branch is under test.
 */
afterEach(() => {
  cleanup();
  localStorage.clear();
});
