// G50 review — the fixtures DROP tables, so the URL guard is the only thing between a typo
// and a wiped database. No database is needed for this file.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { assertDisposable } = require('./fixtures');

describe('assertDisposable', () => {
  for (const url of [
    'postgres://u:p@localhost:5432/gympal_test',
    'postgres://u:p@127.0.0.1:55432/gympal_test',
    'postgres://u:p@[::1]:5432/other_test',
  ]) {
    it(`accepts ${url}`, () => expect(() => assertDisposable(url)).not.toThrow());
  }

  for (const [url, why] of [
    ['postgres://u:p@db.railway.internal:5432/gympal_test', 'a remote host, even with a _test name'],
    ['postgres://u:p@localhost:5432/gympal', 'a non-test name'],
    ['postgres://u:p@localhost:5432/contest', '"test" inside a word'],
    ['postgres://u:p@localhost:5432/latest_prod', '"test" not as the suffix'],
  ]) {
    it(`refuses ${why}`, () => expect(() => assertDisposable(url)).toThrow());
  }
});
