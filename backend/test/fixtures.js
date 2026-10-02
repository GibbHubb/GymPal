// G50 — a disposable Postgres for the request-level tests.
//
// The tests drive the REAL Express app against a REAL database, not a mocked db.query:
// an authorization test that mocks the query passes while the actual SQL selects the
// wrong rows, and selecting the wrong rows is the bug class under test.
//
// TEST_DATABASE_URL must name a database whose name contains "test". The schema step
// DROPs tables, so refusing anything else is the guard against pointing this at a real
// database by accident.
//
// Local:  docker run -d --name gympal-test-pg -e POSTGRES_USER=gympal \
//           -e POSTGRES_PASSWORD=gympal -e POSTGRES_DB=gympal_test -p 55432:5432 postgres:16-alpine
//         TEST_DATABASE_URL=postgres://gympal:gympal@127.0.0.1:55432/gympal_test npm test
// CI:     .github/workflows/ci.yml starts the same container as a service.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TEST_DB_URL = process.env.TEST_DATABASE_URL || '';

function assertDisposable(url) {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(name)) {
    throw new Error(
      `TEST_DATABASE_URL points at database "${name}". The test schema DROPs tables, so the ` +
      'database name must contain "test".');
  }
}

/**
 * Who exists, and how they are linked. Ids are fixed (inserted explicitly) so a test can
 * name the relationship it is exercising rather than a magic number.
 *
 *   clientA (1) ── active link ──── trainerA (3)
 *   clientB (2) ── archived link ── trainerA (3)
 *   trainerB (4)   no links at all
 */
const USERS = {
  clientA:  { user_id: 1, username: 'client_a',  role: 'client' },
  clientB:  { user_id: 2, username: 'client_b',  role: 'client' },
  trainerA: { user_id: 3, username: 'trainer_a', role: 'pt' },
  trainerB: { user_id: 4, username: 'trainer_b', role: 'pt' },
};

async function resetAndSeed(url = TEST_DB_URL) {
  assertDisposable(url);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    for (const u of Object.values(USERS)) {
      await client.query(
        'INSERT INTO users (user_id, username, password, role) VALUES ($1, $2, $3, $4)',
        [u.user_id, u.username, 'not-a-real-hash', u.role]);
    }
    await client.query(`SELECT setval('users_user_id_seq', 100)`);
    await client.query(
      `INSERT INTO trainer_clients (trainer_id, client_id, status) VALUES
         ($1, $2, 'active'), ($1, $3, 'archived')`,
      [USERS.trainerA.user_id, USERS.clientA.user_id, USERS.clientB.user_id]);
    // One row of each kind of personal data for both clients, so an allowed read is a
    // 200 with data rather than a 404 that could be mistaken for a pass.
    for (const u of [USERS.clientA, USERS.clientB]) {
      await client.query(
        'INSERT INTO intake (user_id, client_name, age) VALUES ($1, $2, 30)',
        [u.user_id, u.username]);
      await client.query(
        'INSERT INTO lifestyle_data (user_id, stress, sleep, soreness) VALUES ($1, 3, 7, 2)',
        [u.user_id]);
      await client.query(
        'INSERT INTO body_metrics (user_id, weight, body_fat_pct) VALUES ($1, 80, 15)',
        [u.user_id]);
    }

    // Prove the seed produced the intended topology rather than trusting the INSERTs.
    const { rows } = await client.query(
      'SELECT trainer_id, client_id, status FROM trainer_clients ORDER BY client_id');
    const topology = rows.map((r) => `${r.trainer_id}->${r.client_id}:${r.status}`).join(',');
    if (topology !== '3->1:active,3->2:archived') {
      throw new Error(`fixture topology is wrong: ${topology}`);
    }
  } finally {
    await client.end();
  }
}

module.exports = { TEST_DB_URL, USERS, resetAndSeed, assertDisposable };
