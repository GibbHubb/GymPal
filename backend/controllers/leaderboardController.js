// G31 — Public weekly leaderboard (opt-in).
//
// Scope: same-trainer co-clients of the requester (per plan §8 — no
// friends graph exists today). The user's own row is always included
// if they have opted in. A user who has not opted in NEVER appears
// (even to themselves on the board) — they should see an "opt in to
// appear" CTA instead.
//
// Metric: total sets across all of a user's workouts in the trailing
// 7 days. Tie-break: total reps.

const db = require('../models/db');


/**
 * GET /api/leaderboard/weekly
 * Returns { window_days, opted_in, rows: [{ user_id, username, sets, reps, rank }] }
 */
const getWeekly = async (req, res) => {
  const userId = req.user.user_id;
  try {
    // Has this user opted in? (controls the CTA, not the scoping.)
    const { rows: meRows } = await db.query(
      'SELECT leaderboard_opt_in FROM users WHERE user_id = $1',
      [userId],
    );
    const optedIn = !!(meRows[0] && meRows[0].leaderboard_opt_in);

    // Find the trainer(s) this user is linked to as a client, plus all
    // other clients of those same trainers. Then keep only opted-in.
    const { rows: cohort } = await db.query(
      `WITH my_trainers AS (
         SELECT trainer_id FROM trainer_clients
          WHERE client_id = $1 AND status = 'active'
       )
       SELECT DISTINCT u.user_id, u.username
         FROM trainer_clients tc
         JOIN users u ON u.user_id = tc.client_id
        WHERE tc.trainer_id IN (SELECT trainer_id FROM my_trainers)
          AND tc.status = 'active'
          AND u.leaderboard_opt_in = TRUE
       UNION
       SELECT user_id, username FROM users
        WHERE user_id = $1 AND leaderboard_opt_in = TRUE`,
      [userId],
    );

    if (cohort.length === 0) {
      return res.status(200).json({ window_days: 7, opted_in: optedIn, rows: [] });
    }

    const sinceISO = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const ids = cohort.map((r) => r.user_id);
    const { rows: agg } = await db.query(
      `SELECT w.user_id,
              COALESCE(SUM(we.sets), 0)::int AS sets,
              COALESCE(SUM(we.sets * we.reps), 0)::int AS reps
         FROM Workouts w
         JOIN workout_exercises we ON we.workout_id = w.workout_id
        WHERE w.user_id = ANY($1::int[])
          AND w.date >= $2
        GROUP BY w.user_id`,
      [ids, sinceISO],
    );
    const aMap = Object.fromEntries(agg.map((r) => [r.user_id, r]));

    const rows = cohort.map((u) => ({
      user_id: u.user_id,
      username: u.username,
      sets: aMap[u.user_id]?.sets || 0,
      reps: aMap[u.user_id]?.reps || 0,
    }));
    rows.sort((a, b) => (b.sets - a.sets) || (b.reps - a.reps));
    rows.forEach((r, i) => { r.rank = i + 1; });

    res.status(200).json({ window_days: 7, opted_in: optedIn, rows });
  } catch (err) {
    console.error('[G31] getWeekly error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


/**
 * PATCH /api/leaderboard/opt-in  { opt_in: boolean }
 */
const setOptIn = async (req, res) => {
  const userId = req.user.user_id;
  const { opt_in } = req.body;
  try {
    await db.query(
      'UPDATE users SET leaderboard_opt_in = $1 WHERE user_id = $2',
      [!!opt_in, userId],
    );
    res.status(200).json({ opted_in: !!opt_in });
  } catch (err) {
    console.error('[G31] setOptIn error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = { getWeekly, setOptIn };
