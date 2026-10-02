// G50 — the backend suite: unit tests beside the code (`**/__tests__/`) plus the
// request-level tests in `test/` that need TEST_DATABASE_URL (see test/fixtures.js).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/__tests__/**/*.test.js', 'test/**/*.test.js'],
    exclude: ['node_modules/**'],
    // The DB-backed file resets a shared database; never run two files against it at once.
    fileParallelism: false,
  },
});
