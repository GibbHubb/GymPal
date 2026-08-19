const db = require('../models/db');

/**
 * Get weekly training summary for a client.
 * Returns { sessions, volume, streak }.
 */
async function getWeeklySummary(userId) {
  // Sessions in the last 7 days
  const { rows: sessionRows } = await db.query(
    `SELECT COUNT(DISTINCT workout_id) AS sessions
     FROM Workouts
     WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'`,
    [userId]
  );
  const sessions = parseInt(sessionRows[0]?.sessions || '0', 10);

  // Total volume (sets × reps × weight)
  const { rows: volumeRows } = await db.query(
    `SELECT COALESCE(SUM(
       COALESCE(we.sets, 1) * COALESCE(we.reps, 1) * COALESCE(we.weight, 0)
     ), 0) AS volume
     FROM workout_exercises we
     JOIN Workouts w ON we.workout_id = w.workout_id
     WHERE w.user_id = $1 AND w.date >= NOW() - INTERVAL '7 days'`,
    [userId]
  );
  const volume = Math.round(parseFloat(volumeRows[0]?.volume || '0'));

  // Streak: consecutive ISO weeks with ≥1 session (look back up to 52 weeks)
  let streak = 0;
  for (let weeksAgo = 0; weeksAgo < 52; weeksAgo++) {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM Workouts
       WHERE user_id = $1
         AND date >= (NOW() - INTERVAL '${weeksAgo + 1} weeks')
         AND date < (NOW() - INTERVAL '${weeksAgo} weeks')`,
      [userId]
    );
    if (parseInt(rows[0].cnt, 10) > 0) {
      streak++;
    } else {
      break;
    }
  }

  return { sessions, volume, streak };
}

module.exports = { getWeeklySummary };
