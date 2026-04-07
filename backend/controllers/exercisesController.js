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
const createExercise = async (req, res) => {
    const { name, muscle_group, difficulty } = req.body;

    // Validate required fields
    if (!name || !muscle_group || !difficulty) {
        return res.status(400).json({
            message: 'Invalid input: "name", "muscle_group", and "difficulty" are required.',
        });
    }

    try {
        const { rows } = await db.query(
            `
            INSERT INTO exercises (name, muscle_group, difficulty) 
            VALUES ($1, $2, $3) 
            RETURNING *
            `,
            [name.trim(), muscle_group.trim(), difficulty.trim()]
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
const updateExercise = async (req, res) => {
    const { id } = req.params;
    const { name, muscle_group, difficulty } = req.body;

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
            SET name = $1, muscle_group = $2, difficulty = $3
            WHERE exercise_id = $4
            RETURNING *
            `,
            [name.trim(), muscle_group.trim(), difficulty.trim(), id]
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
