// G12 — Trainer-client relationship management.
//
// Read/write operations are scoped to the calling trainer's user_id.
// Only users with role 'pt' / 'masterPt' / 'trainer' may use these endpoints.

const db = require('../models/db');

function _isTrainer(role) {
  return role === 'pt' || role === 'masterPt' || role === 'trainer';
}

function _requireTrainer(req, res) {
  if (!_isTrainer(req.user?.role)) {
    res.status(403).json({ message: 'Trainer role required.' });
    return false;
  }
  return true;
}

/** GET /api/trainer-clients — list the calling trainer's clients. */
const listClients = async (req, res) => {
  if (!_requireTrainer(req, res)) return;
  const trainerId = req.user.user_id;
  const status = req.query.status || 'active'; // 'active' | 'archived' | 'all'

  try {
    const params = [trainerId];
    let sql = `
      SELECT tc.id            AS link_id,
             tc.client_id     AS user_id,
             u.username,
             tc.is_primary,
             tc.status,
             tc.started_at
        FROM trainer_clients tc
        JOIN users u ON u.user_id = tc.client_id
       WHERE tc.trainer_id = $1`;
    if (status !== 'all') {
      params.push(status);
      sql += ` AND tc.status = $2`;
    }
    sql += ` ORDER BY tc.is_primary DESC, u.username ASC`;
    const { rows } = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error('[G12] listClients error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/** POST /api/trainer-clients — link a client by username. Body: { username, is_primary? } */
const addClient = async (req, res) => {
  if (!_requireTrainer(req, res)) return;
  const trainerId = req.user.user_id;
  const { username, is_primary = false } = req.body || {};
  if (!username) {
    return res.status(400).json({ message: 'username is required' });
  }

  try {
    const { rows: users } = await db.query(
      `SELECT user_id, username, role FROM users WHERE username = $1`,
      [username],
    );
    const client = users[0];
    if (!client) {
      return res.status(404).json({ message: `No user with username '${username}'.` });
    }
    if (client.role !== 'client' && client.role !== 'user') {
      return res.status(400).json({ message: `User '${username}' is not a client account.` });
    }
    if (client.user_id === trainerId) {
      return res.status(400).json({ message: 'A trainer cannot add themselves as a client.' });
    }

    // Upsert: re-activate if previously archived, no-op if already active.
    const { rows } = await db.query(
      `INSERT INTO trainer_clients (trainer_id, client_id, is_primary, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (trainer_id, client_id)
       DO UPDATE SET status = 'active',
                     is_primary = EXCLUDED.is_primary
       RETURNING id, trainer_id, client_id, is_primary, status, started_at`,
      [trainerId, client.user_id, is_primary],
    );
    res.status(201).json({
      link_id: rows[0].id,
      user_id: client.user_id,
      username: client.username,
      is_primary: rows[0].is_primary,
      status: rows[0].status,
      started_at: rows[0].started_at,
    });
  } catch (err) {
    console.error('[G12] addClient error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/** PATCH /api/trainer-clients/:linkId — body: { status?, is_primary? } */
const updateLink = async (req, res) => {
  if (!_requireTrainer(req, res)) return;
  const trainerId = req.user.user_id;
  const linkId = parseInt(req.params.linkId, 10);
  const { status, is_primary } = req.body || {};

  if (status && !['active', 'archived'].includes(status)) {
    return res.status(400).json({ message: "status must be 'active' or 'archived'." });
  }

  try {
    const { rows } = await db.query(
      `UPDATE trainer_clients
          SET status     = COALESCE($1, status),
              is_primary = COALESCE($2, is_primary)
        WHERE id = $3 AND trainer_id = $4
        RETURNING id, trainer_id, client_id, is_primary, status, started_at`,
      [status ?? null, typeof is_primary === 'boolean' ? is_primary : null, linkId, trainerId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Link not found for this trainer.' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('[G12] updateLink error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/** DELETE /api/trainer-clients/:linkId — hard remove. */
const deleteLink = async (req, res) => {
  if (!_requireTrainer(req, res)) return;
  const trainerId = req.user.user_id;
  const linkId = parseInt(req.params.linkId, 10);
  try {
    const { rowCount } = await db.query(
      `DELETE FROM trainer_clients WHERE id = $1 AND trainer_id = $2`,
      [linkId, trainerId],
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Link not found for this trainer.' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('[G12] deleteLink error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// G28 — Trainer compliance dashboard.
//
// For each of the trainer's linked clients, return a red/amber/green
// signal computed as: (workouts logged in the trailing 7 days) /
// (workouts assigned to that client in the same window) capped at 1.0.
//
// Bucketing: >=0.8 green, >=0.5 amber, else red. When the assigned
// count is zero we surface "no plan" rather than red (a client with
// no schedule shouldn't look non-compliant).
const getCompliance = async (req, res) => {
  const trainerId = req.user.user_id;
  try {
    const { rows: links } = await db.query(
      `SELECT tc.id AS link_id, u.user_id, u.username
         FROM trainer_clients tc
         JOIN users u ON u.user_id = tc.client_id
        WHERE tc.trainer_id = $1 AND tc.status = 'active'
        ORDER BY u.username`,
      [trainerId],
    );

    const sinceISO = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

    // Per-client counts in two single queries (assigned + logged) so this
    // scales linearly with #clients rather than O(N) round-trips.
    const clientIds = links.map((l) => l.user_id);
    if (clientIds.length === 0) {
      return res.status(200).json({ window_days: 7, clients: [] });
    }

    const { rows: assigned } = await db.query(
      `SELECT user_id, COUNT(*)::int AS n
         FROM Workouts
        WHERE user_id = ANY($1::int[])
          AND date >= $2
        GROUP BY user_id`,
      [clientIds, sinceISO],
    );
    const { rows: logged } = await db.query(
      `SELECT w.user_id, COUNT(*)::int AS n
         FROM Workouts w
         JOIN workout_exercises we ON we.workout_id = w.workout_id
        WHERE w.user_id = ANY($1::int[])
          AND w.date >= $2
        GROUP BY w.user_id`,
      [clientIds, sinceISO],
    );
    const aMap = Object.fromEntries(assigned.map((r) => [r.user_id, r.n]));
    const lMap = Object.fromEntries(logged.map((r) => [r.user_id, r.n]));

    const out = links.map((l) => {
      const a = aMap[l.user_id] || 0;
      const lg = Math.min(lMap[l.user_id] || 0, a);  // can't be > assigned
      const ratio = a > 0 ? lg / a : null;
      let status = 'no_plan';
      if (ratio !== null) {
        status = ratio >= 0.8 ? 'green' : ratio >= 0.5 ? 'amber' : 'red';
      }
      return {
        user_id: l.user_id,
        username: l.username,
        assigned: a,
        logged: lg,
        ratio,
        status,
      };
    });
    res.status(200).json({ window_days: 7, clients: out });
  } catch (err) {
    console.error('[G28] getCompliance error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {
  listClients,
  addClient,
  updateLink,
  deleteLink,
  getCompliance,  // G28
};
