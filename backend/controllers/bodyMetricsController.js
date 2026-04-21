const db = require('../models/db');

/**
 * G10 — Create a new body metric entry for the authenticated user.
 * Expects: { weight (required), body_fat_pct?, notes?, logged_at? }
 */
const createBodyMetric = async (req, res) => {
  const { user_id } = req.user;
  const { weight, body_fat_pct, notes, logged_at } = req.body;

  const w = parseFloat(weight);
  if (!w || isNaN(w) || w <= 0 || w >= 700) {
    return res.status(400).json({ message: 'A valid weight (0-700 kg) is required.' });
  }

  let bf = null;
  if (body_fat_pct !== undefined && body_fat_pct !== null && body_fat_pct !== '') {
    bf = parseFloat(body_fat_pct);
    if (isNaN(bf) || bf < 0 || bf > 100) {
      return res.status(400).json({ message: 'body_fat_pct must be between 0 and 100.' });
    }
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO body_metrics (user_id, weight, body_fat_pct, notes, logged_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))
       RETURNING *`,
      [user_id, w, bf, notes || null, logged_at || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[G10] Error creating body metric:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * G10 — List body metrics for a user. Only the owner (or a trainer role) may read.
 */
const getBodyMetrics = async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user.user_id;
  const role = req.user.role;

  const targetId = parseInt(userId, 10);
  if (!targetId || isNaN(targetId)) {
    return res.status(400).json({ message: 'Invalid user ID.' });
  }

  const isTrainer = role === 'pt' || role === 'masterPt' || role === 'trainer';
  if (targetId !== requesterId && !isTrainer) {
    return res.status(403).json({ message: 'Not authorised to view metrics for this user.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT id, user_id, weight, body_fat_pct, notes, logged_at, created_at
         FROM body_metrics
        WHERE user_id = $1
        ORDER BY logged_at ASC, id ASC`,
      [targetId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('[G10] Error fetching body metrics:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { createBodyMetric, getBodyMetrics };
