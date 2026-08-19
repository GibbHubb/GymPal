// G16 — Trainer program builder.
//
// All trainer-side reads/writes scope by req.user.user_id.
// Today's-session resolver is per-client (any signed-in user can call it
// for themselves) — it walks: most-recent active assignment for the
// caller → derive (week_number, day_of_week) from start_date + today →
// look up program_days row → return template (or rest day).

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

// ---------------------------------------------------------------------------
// Programs CRUD
// ---------------------------------------------------------------------------

const listPrograms = async (req, res) => {
    if (!_requireTrainer(req, res)) return;
    try {
        const { rows } = await db.query(
            `SELECT id, name, total_weeks, description, created_at
               FROM programs
              WHERE trainer_id = $1
              ORDER BY created_at DESC`,
            [req.user.user_id],
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('[G16] listPrograms:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const createProgram = async (req, res) => {
    if (!_requireTrainer(req, res)) return;
    const { name, total_weeks, description = null } = req.body || {};
    if (!name || !total_weeks) {
        return res.status(400).json({ message: '"name" and "total_weeks" are required.' });
    }
    const weeks = Math.max(1, Math.min(52, parseInt(total_weeks, 10) || 1));
    try {
        const { rows } = await db.query(
            `INSERT INTO programs (trainer_id, name, total_weeks, description)
                  VALUES ($1, $2, $3, $4)
               RETURNING id, name, total_weeks, description, created_at`,
            [req.user.user_id, String(name).trim(), weeks, description],
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[G16] createProgram:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getProgram = async (req, res) => {
    if (!_requireTrainer(req, res)) return;
    const programId = parseInt(req.params.id, 10);
    try {
        const { rows: progRows } = await db.query(
            `SELECT id, name, total_weeks, description, created_at
               FROM programs
              WHERE id = $1 AND trainer_id = $2`,
            [programId, req.user.user_id],
        );
        if (!progRows[0]) return res.status(404).json({ message: 'Program not found.' });

        const { rows: dayRows } = await db.query(
            `SELECT pd.id, pd.week_number, pd.day_of_week, pd.template_id, pd.notes,
                    wt.name AS template_name
               FROM program_days pd
          LEFT JOIN workout_templates wt ON wt.id = pd.template_id
              WHERE pd.program_id = $1
              ORDER BY pd.week_number, pd.day_of_week`,
            [programId],
        );
        res.status(200).json({ ...progRows[0], days: dayRows });
    } catch (err) {
        console.error('[G16] getProgram:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteProgram = async (req, res) => {
    if (!_requireTrainer(req, res)) return;
    const programId = parseInt(req.params.id, 10);
    try {
        const { rowCount } = await db.query(
            `DELETE FROM programs WHERE id = $1 AND trainer_id = $2`,
            [programId, req.user.user_id],
        );
        if (rowCount === 0) return res.status(404).json({ message: 'Program not found.' });
        res.status(204).send();
    } catch (err) {
        console.error('[G16] deleteProgram:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ---------------------------------------------------------------------------
// Program-day cells (the week × day grid)
// ---------------------------------------------------------------------------

/**
 * PUT /api/programs/:id/days — body: { week_number, day_of_week, template_id, notes? }
 * Upsert one cell. Setting template_id to null is the way to clear a cell.
 */
const upsertProgramDay = async (req, res) => {
    if (!_requireTrainer(req, res)) return;
    const programId = parseInt(req.params.id, 10);
    const { week_number, day_of_week, template_id, notes = null } = req.body || {};

    if (week_number == null || day_of_week == null) {
        return res.status(400).json({ message: '"week_number" and "day_of_week" are required.' });
    }
    if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json({ message: 'day_of_week must be 0..6.' });
    }

    try {
        // Confirm program ownership
        const { rows: progRows } = await db.query(
            `SELECT id, total_weeks FROM programs WHERE id = $1 AND trainer_id = $2`,
            [programId, req.user.user_id],
        );
        const program = progRows[0];
        if (!program) return res.status(404).json({ message: 'Program not found.' });
        if (week_number < 1 || week_number > program.total_weeks) {
            return res.status(400).json({ message: `week_number must be 1..${program.total_weeks}.` });
        }

        if (!template_id) {
            // Clear the cell
            await db.query(
                `DELETE FROM program_days
                       WHERE program_id = $1 AND week_number = $2 AND day_of_week = $3`,
                [programId, week_number, day_of_week],
            );
            return res.status(204).send();
        }

        // Verify template belongs to this trainer
        const { rows: tplRows } = await db.query(
            `SELECT id FROM workout_templates WHERE id = $1 AND trainer_id = $2`,
            [template_id, req.user.user_id],
        );
        if (!tplRows[0]) return res.status(400).json({ message: 'Template not found for this trainer.' });

        const { rows } = await db.query(
            `INSERT INTO program_days (program_id, week_number, day_of_week, template_id, notes)
                  VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (program_id, week_number, day_of_week)
             DO UPDATE SET template_id = EXCLUDED.template_id, notes = EXCLUDED.notes
               RETURNING id, week_number, day_of_week, template_id, notes`,
            [programId, week_number, day_of_week, template_id, notes],
        );
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('[G16] upsertProgramDay:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// ---------------------------------------------------------------------------
// Client assignments
// ---------------------------------------------------------------------------

const assignProgram = async (req, res) => {
    if (!_requireTrainer(req, res)) return;
    const programId = parseInt(req.params.id, 10);
    const { client_id, start_date } = req.body || {};

    if (!client_id || !start_date) {
        return res.status(400).json({ message: '"client_id" and "start_date" are required.' });
    }

    try {
        // Trainer may only assign their own programs
        const { rows: progRows } = await db.query(
            `SELECT id FROM programs WHERE id = $1 AND trainer_id = $2`,
            [programId, req.user.user_id],
        );
        if (!progRows[0]) return res.status(404).json({ message: 'Program not found.' });

        // Trainer may only assign to active linked clients (G12)
        const { rows: linkRows } = await db.query(
            `SELECT id FROM trainer_clients
              WHERE trainer_id = $1 AND client_id = $2 AND status = 'active'`,
            [req.user.user_id, client_id],
        );
        if (!linkRows[0]) {
            return res.status(400).json({ message: 'Client is not in this trainer\'s active list.' });
        }

        const { rows } = await db.query(
            `INSERT INTO client_program_assignments (client_id, program_id, start_date)
                  VALUES ($1, $2, $3)
               RETURNING id, client_id, program_id, start_date, status, created_at`,
            [client_id, programId, start_date],
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[G16] assignProgram:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * GET /api/programs/today — what should the calling client train today?
 * Returns either a template suggestion or a rest-day signal. Auto-completes
 * any assignment whose final week ended in the past.
 */
const todayForClient = async (req, res) => {
    const userId = req.user.user_id;
    try {
        const { rows: aRows } = await db.query(
            `SELECT a.id, a.program_id, a.start_date, a.status,
                    p.total_weeks, p.name AS program_name
               FROM client_program_assignments a
               JOIN programs p ON p.id = a.program_id
              WHERE a.client_id = $1 AND a.status = 'active'
              ORDER BY a.created_at DESC
              LIMIT 1`,
            [userId],
        );
        const assignment = aRows[0];
        if (!assignment) return res.status(200).json({ active: false });

        const start = new Date(assignment.start_date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return res.status(200).json({
                active: true, in_future: true, starts_in_days: -diffDays,
                program_name: assignment.program_name,
            });
        }

        const weekIdx = Math.floor(diffDays / 7) + 1; // 1-indexed
        if (weekIdx > assignment.total_weeks) {
            // Auto-complete on read
            await db.query(
                `UPDATE client_program_assignments SET status = 'completed' WHERE id = $1`,
                [assignment.id],
            );
            return res.status(200).json({
                active: false, just_completed: true,
                program_name: assignment.program_name,
            });
        }

        const todayDow = today.getDay(); // 0..6 (Sun)
        const { rows: dayRows } = await db.query(
            `SELECT pd.template_id, pd.notes,
                    wt.name AS template_name, wt.exercises
               FROM program_days pd
          LEFT JOIN workout_templates wt ON wt.id = pd.template_id
              WHERE pd.program_id = $1 AND pd.week_number = $2 AND pd.day_of_week = $3`,
            [assignment.program_id, weekIdx, todayDow],
        );

        if (!dayRows[0]) {
            return res.status(200).json({
                active: true, rest_day: true,
                program_name: assignment.program_name,
                week: weekIdx, total_weeks: assignment.total_weeks,
            });
        }

        res.status(200).json({
            active: true,
            program_name: assignment.program_name,
            week: weekIdx,
            total_weeks: assignment.total_weeks,
            template_id: dayRows[0].template_id,
            template_name: dayRows[0].template_name,
            exercises: dayRows[0].exercises,
            notes: dayRows[0].notes,
        });
    } catch (err) {
        console.error('[G16] todayForClient:', err.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    listPrograms,
    createProgram,
    getProgram,
    deleteProgram,
    upsertProgramDay,
    assignProgram,
    todayForClient,
};
