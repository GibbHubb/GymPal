const db = require('../models/db');

// Fetch all group workouts
const getGroupWorkouts = async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT * 
            FROM group_workouts 
            ORDER BY date DESC
        `);

        if (!rows.length) {
            return res.status(404).json({ message: 'No group workouts found.' });
        }

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching group workouts:', err.message);
        res.status(500).json({ message: 'Internal server error.', details: err.message });
    }
};

// Fetch group workout details
const getGroupWorkoutDetails = async (req, res) => {
    const id = parseInt(req.params.id, 10); // ✅ Ensure `id` is an integer

    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid group workout ID: must be a number.' });
    }

    try {
        // Fetch group workout details
        const workoutQuery = `
            SELECT * 
            FROM group_workouts 
            WHERE group_workout_id = $1
        `;
        const { rows: workoutRows } = await db.query(workoutQuery, [id]);

        if (!workoutRows.length) {
            return res.status(404).json({ message: 'Group workout not found.' });
        }
        const groupWorkout = workoutRows[0];

        // Fetch exercises with reps
        const exercisesQuery = `
            SELECT gwe.exercise_id, gwe.reps, e.name AS exercise_name
            FROM group_workout_exercises gwe
            JOIN exercises e ON gwe.exercise_id = e.exercise_id
            WHERE gwe.group_workout_id = $1
        `;
        const { rows: exerciseRows } = await db.query(exercisesQuery, [id]); // ✅ Pass [id] correctly

        // Fetch participants with reps
        const participantsQuery = `
            SELECT 
                gwp.user_id, u.username AS participant_name, 
                gwe.exercise_id, gwe.reps
            FROM group_workout_participants gwp
            JOIN users u ON gwp.user_id = u.user_id
            JOIN group_workout_exercises gwe ON gwp.group_workout_id = gwe.group_workout_id
            WHERE gwp.group_workout_id = $1
        `;
        const { rows: participantRows } = await db.query(participantsQuery, [id]); // ✅ Pass [id] correctly

        // Format participants to include reps per exercise
        const participantsMap = {};
        participantRows.forEach(({ user_id, participant_name, exercise_id, reps }) => {
            if (!participantsMap[user_id]) {
                participantsMap[user_id] = { user_id, participant_name, exercises: [] };
            }
            participantsMap[user_id].exercises.push({ exercise_id, reps });
        });

        res.status(200).json({
            groupWorkout,
            exercises: exerciseRows,
            participants: Object.values(participantsMap),
        });
    } catch (err) {
        console.error('❌ Error fetching group workout details:', err.message);
        res.status(500).json({ message: 'Internal server error.', details: err.message });
    }
};


// Create a new group workout
const createGroupWorkout = async (req, res) => {
    const { name, trainer_id, date, notes, exercises, participants } = req.body;

    // Validate required fields
    if (!name || !trainer_id || !Array.isArray(exercises)) {
        return res.status(400).json({
            message: 'Invalid input: "name", "trainer_id", and "exercises" are required.',
        });
    }

    // Ensure trainer_id is an integer
    if (isNaN(trainer_id)) {
        return res.status(400).json({
            message: 'Invalid input: "trainer_id" must be a valid integer.',
        });
    }

    try {
        // Insert group workout
        const workoutQuery = `
            INSERT INTO group_workouts (name, trainer_id, date, notes) 
            VALUES ($1, $2, $3, $4) 
            RETURNING *
        `;
        const { rows: workoutRows } = await db.query(workoutQuery, [
            name,
            parseInt(trainer_id, 10), // Ensure trainer_id is an integer
            date || new Date().toISOString(),
            notes || null,
        ]);

        const groupWorkout = workoutRows[0];
        const groupWorkoutId = groupWorkout.group_workout_id;

        // Insert exercises
        if (exercises.length > 0) {
            const exercisePromises = exercises.map((exercise) =>
                db.query(
                    `
                    INSERT INTO group_workout_exercises (group_workout_id, exercise_id, sets, reps, weight) 
                    VALUES ($1, $2, $3, $4, $5)
                `,
                    [
                        groupWorkoutId,
                        exercise.exercise_id,
                        exercise.sets || 0,
                        exercise.reps || 0,
                        exercise.weight || 0,
                    ]
                )
            );

            await Promise.all(exercisePromises);
        }

        // Insert participants (if any)
        if (participants && participants.length > 0) {
            const participantPromises = participants.map((participant) =>
                db.query(
                    `
                    INSERT INTO group_workout_participants (group_workout_id, user_id, custom_reps, custom_sets, custom_weights, notes) 
                    VALUES ($1, $2, $3, $4, $5, $6)
                `,
                    [
                        groupWorkoutId,
                        participant.user_id,
                        participant.custom_reps || null,
                        participant.custom_sets || null,
                        participant.custom_weights || null,
                        participant.notes || null,
                    ]
                )
            );

            await Promise.all(participantPromises);
        }

        // Return the created workout details
        res.status(201).json({
            message: 'Group workout created successfully.',
            groupWorkout,
        });
    } catch (err) {
        console.error('Error creating group workout:', err.message);
        res.status(500).json({ message: 'Internal server error.', details: err.message });
    }
};



const getWorkoutsByLevel = async (req, res) => {
    const { level } = req.query;

    try {
        let query;
        let params = [];

        if (level) {
            // Query for specific level workouts
            query = 'SELECT * FROM public.group_workouts WHERE level = $1';
            params = [level];
            console.log(`Fetching workouts for level: ${level}`);
        } else {
            // Query for grouped workouts
            query = `
                SELECT level, json_agg(row_to_json(workouts)) AS workouts
                FROM public.group_workouts AS workouts
                GROUP BY level
                ORDER BY level
            `;
            console.log('Fetching all workouts grouped by level');
        }

        const { rows } = await db.query(query, params); // Use db.query

        if (rows.length === 0) {
            const message = level
                ? `No workouts found for level: ${level}`
                : 'No workouts found in the database.';
            return res.status(404).json({ message });
        }

        res.status(200).json(rows); // Send the query results
    } catch (error) {
        console.error('Error fetching workouts:', error.message); // Log the error
        res.status(500).json({ error: 'Failed to fetch workouts' });
    }
};

const getYourWorkouts = async (req, res) => {
    const userId = req.user.id; // Assuming `req.user` is populated by authentication middleware

    try {
        const query = 'SELECT * FROM public.group_workouts WHERE trainer_id = $1 ORDER BY date DESC';
        const { rows } = await db.query(query, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No workouts found for the current user.' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching your workouts:', error.message);
        res.status(500).json({ error: 'Failed to fetch your workouts' });
    }
};


const getLast10Workouts = async (req, res) => {
    try {
        const query = `
            SELECT * FROM public.group_workouts 
            WHERE trainer_id IS NULL 
            ORDER BY date DESC 
            LIMIT 10
        `;
        const { rows } = await db.query(query);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No public workouts found.' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching last 10 workouts:', error.message);
        res.status(500).json({ error: 'Failed to fetch last 10 workouts' });
    }
};

const getMostUsedWorkouts = async (req, res) => {
    try {
        const query = `
            SELECT * FROM public.group_workouts 
            ORDER BY usage_count DESC 
            LIMIT 10
        `;
        const { rows } = await db.query(query);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No workouts found.' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching most used workouts:', error.message);
        res.status(500).json({ error: 'Failed to fetch most used workouts' });
    }
};

const searchWorkouts = async (req, res) => {
    const { query } = req.query;

    try {
        if (!query || query.trim() === '') {
            return res.status(400).json({ message: 'Search query is required.' });
        }

        const searchQuery = `
            SELECT * FROM public.group_workouts
            WHERE name ILIKE $1
            ORDER BY name ASC
        `;
        const params = [`%${query}%`];

        const { rows } = await db.query(searchQuery, params);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No workouts match your search.' });
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error('Error searching workouts:', error.message);
        res.status(500).json({ error: 'Failed to search workouts.' });
    }
};

const editGroupWorkout = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, trainer_id, date, notes, level, duration, expected_sets, expected_reps, expected_weight } = req.body;

        // Create a new version of the workout
        const editedWorkout = await db.query(
            `INSERT INTO group_workouts (name, trainer_id, date, notes, level, duration, parent_workout_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, trainer_id, date, notes, level, duration, id]
        );

        const newGroupWorkoutId = editedWorkout.rows[0].group_workout_id;

        // Update user_workouts to link to the new group workout
        await db.query(
            `UPDATE user_workouts 
             SET workout_id = $1 
             WHERE group_workout_id = $2`,
            [newGroupWorkoutId, id]
        );

        res.status(201).json({ success: true, workout: editedWorkout.rows[0] });
    } catch (err) {
        console.error('Error editing group workout:', err.message);
        res.status(500).json({ message: 'Internal server error.', details: err.message });
    }
};

const finishGroupWorkout = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, actual_sets, actual_reps, actual_weight } = req.body;

        // Update user_workouts with actual performance
        await db.query(
            `UPDATE user_workouts 
             SET actual_sets = $1, actual_reps = $2, actual_weight = $3, status = 'completed', completed_at = NOW()
             WHERE user_id = $4 AND group_workout_id = $5`,
            [actual_sets, actual_reps, actual_weight, user_id, id]
        );

        // Insert into completed_group_workouts
        const finishedWorkout = await db.query(
            `INSERT INTO completed_group_workouts (group_workout_id, user_id, actual_sets, actual_reps, actual_weight)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, user_id, actual_sets, actual_reps, actual_weight]
        );

        res.status(200).json({ success: true, completedWorkout: finishedWorkout.rows[0] });
    } catch (err) {
        console.error('Error finishing group workout:', err.message);
        res.status(500).json({ message: 'Internal server error.', details: err.message });
    }
};





module.exports = {
    getGroupWorkouts,
    getGroupWorkoutDetails,
    createGroupWorkout,
    getWorkoutsByLevel,
    getLast10Workouts,
    getMostUsedWorkouts,
    getYourWorkouts,
    searchWorkouts,
    editGroupWorkout,
    finishGroupWorkout

};
