// G50 — the root (mobile app) suite. backend/ is its own package with its own
// dependencies and its own suite (`npm --prefix backend test`), so it is excluded here:
// a fresh clone that has only run `npm ci` at the root cannot resolve express or pg.
import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'backend/**', 'landing/**'],
  },
});
