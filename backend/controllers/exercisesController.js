const db = require('../models/db');

// Fetch all exercises
const getExercises = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM exercises ORDER BY name ASC');
        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: 'No exercises found.' });
        }
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching exercises:', err.message);
        res.status(500).json({
            message: 'An error occurred while fetching exercises.',
            details: err.message,
        });
    }
};

// Create a new exercise
// G13 — accepts the four new library fields. Legacy 3-field callers stay
// valid because every new field has a sane default.
const createExercise = async (req, res) => {
    const {
        name, muscle_group, difficulty,
        equipment = null,
        video_url = null,
        default_rest_seconds = 90,
        is_global = false,
    } = req.body;

    // Validate required fields
    if (!name || !muscle_group || !difficulty) {
        return res.status(400).json({
            message: 'Invalid input: "name", "muscle_group", and "difficulty" are required.',
        });
    }

    try {
        const { rows } = await db.query(
            `
            INSERT INTO exercises
                (name, muscle_group, difficulty, equipment, video_url, default_rest_seconds, is_global)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                name.trim(),
                muscle_group.trim(),
                difficulty.trim(),
                equipment ? String(equipment).trim() : null,
                video_url ? String(video_url).trim() : null,
                Math.max(15, Math.min(900, parseInt(default_rest_seconds, 10) || 90)),
                !!is_global,
            ]
        );

        res.status(201).json({
            message: 'Exercise created successfully.',
            exercise: rows[0],
        });
    } catch (err) {
        console.error('Error creating exercise:', err.message);
        if (err.message.includes('duplicate key value')) {
            return res.status(400).json({
                message: 'An exercise with this name already exists.',
            });
        }
        res.status(500).json({
            message: 'An error occurred while creating the exercise.',
            details: err.message,
        });
    }
};

// Fetch exercise details by ID
const getExerciseById = async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid exercise ID: ID must be a number.' });
    }

    try {
        const { rows } = await db.query(
            `
            SELECT * FROM exercises 
            WHERE exercise_id = $1
            `,
            [id]
        );

        if (!rows[0]) {
            return res.status(404).json({ message: 'Exercise not found.' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error fetching exercise details:', err.message);
        res.status(500).json({
            message: 'An error occurred while fetching the exercise details.',
            details: err.message,
        });
    }
};

// Update an exercise
// G13 — partial update over new library columns; COALESCE keeps any field
// the caller didn't send at its existing value.
const updateExercise = async (req, res) => {
    const { id } = req.params;
    const {
        name, muscle_group, difficulty,
        equipment, video_url, default_rest_seconds, is_global,
    } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid exercise ID: ID must be a number.' });
    }

    if (!name || !muscle_group || !difficulty) {
        return res.status(400).json({
            message: 'Invalid input: "name", "muscle_group", and "difficulty" are required.',
        });
    }

    try {
        const { rows } = await db.query(
            `
            UPDATE exercises
            SET name                 = $1,
                muscle_group         = $2,
                difficulty           = $3,
                equipment            = COALESCE($4, equipment),
                video_url            = COALESCE($5, video_url),
                default_rest_seconds = COALESCE($6, default_rest_seconds),
                is_global            = COALESCE($7, is_global)
            WHERE exercise_id = $8
            RETURNING *
            `,
            [
                name.trim(),
                muscle_group.trim(),
                difficulty.trim(),
                equipment !== undefined && equipment !== null ? String(equipment).trim() : null,
                video_url !== undefined && video_url !== null ? String(video_url).trim() : null,
                default_rest_seconds !== undefined && default_rest_seconds !== null
                    ? Math.max(15, Math.min(900, parseInt(default_rest_seconds, 10) || 90))
                    : null,
                typeof is_global === 'boolean' ? is_global : null,
                id,
            ]
        );

        if (!rows[0]) {
            return res.status(404).json({ message: 'Exercise not found.' });
        }

        res.status(200).json({
            message: 'Exercise updated successfully.',
            exercise: rows[0],
        });
    } catch (err) {
        console.error('Error updating exercise:', err.message);
        res.status(500).json({
            message: 'An error occurred while updating the exercise.',
            details: err.message,
        });
    }
};

// Delete an exercise
const deleteExercise = async (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid exercise ID: ID must be a number.' });
    }

    try {
        const { rowCount } = await db.query(
            `
            DELETE FROM exercises 
            WHERE exercise_id = $1
            `,
            [id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Exercise not found.' });
        }

        res.status(200).json({ message: 'Exercise deleted successfully.' });
    } catch (err) {
        console.error('Error deleting exercise:', err.message);
        res.status(500).json({
            message: 'An error occurred while deleting the exercise.',
            details: err.message,
        });
    }
};

// Search exercises by name or muscle group
const searchExercises = async (req, res) => {
    const { query } = req.query;

    if (!query || query.trim() === '') {
        return res.status(400).json({ message: 'Search query is required.' });
    }

    try {
        const { rows } = await db.query(
            `
            SELECT * FROM exercises 
            WHERE name ILIKE $1 OR muscle_group ILIKE $1
            ORDER BY name ASC
            `,
            [`%${query.trim()}%`]
        );

        res.status(200).json({
            count: rows.length,
            exercises: rows,
        });
    } catch (err) {
        console.error('Error searching exercises:', err.message);
        res.status(500).json({
            message: 'An error occurred while searching exercises.',
            details: err.message,
        });
    }
};

module.exports = {
    getExercises,
    createExercise,
    getExerciseById,
    updateExercise,
    deleteExercise,
    searchExercises,
};
