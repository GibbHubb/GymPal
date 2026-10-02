// G50 — the backend suite: unit tests beside the code (`**/__tests__/`) plus the
// request-level tests in `test/` that need TEST_DATABASE_URL (see test/fixtures.js).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // G48 — test/syncEngine.e2e.test.js runs the APP's sync engine (../utils/) against this
  // backend. Its two React Native imports are not installed in backend/node_modules (CI
  // installs only the backend), so they resolve to in-memory stand-ins.
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': here('../utils/__tests__/asyncStorageMock.js'),
      '@react-native-community/netinfo': here('./test/stubs/netinfo.js'),
    },
  },
  test: {
    include: ['**/__tests__/**/*.test.js', 'test/**/*.test.js'],
    exclude: ['node_modules/**'],
    // The DB-backed file resets a shared database; never run two files against it at once.
    fileParallelism: false,
  },
});
