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

module.exports = {
  listClients,
  addClient,
  updateLink,
  deleteLink,
};
