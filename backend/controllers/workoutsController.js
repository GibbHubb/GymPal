const db = require('../models/db');

// Get all workouts
const getWorkouts = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM Workouts');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching workouts:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create a new workout
const createWorkout = async (req, res) => {
  const { user_id } = req.user; // Get the user ID from the authenticated token
  const { name, date, notes, exercises } = req.body;

  if (!name || !Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({
      message: 'Invalid input: "name" and "exercises" are required fields.',
    });
  }

  try {
    const query =
      'INSERT INTO Workouts (user_id, name, date, notes) VALUES ($1, $2, $3, $4) RETURNING *';

    const { rows: workoutRows } = await db.query(query, [
      user_id,
      name,
      date || new Date(),
      notes,
    ]);

    const workout = workoutRows[0];
    const workoutId = workout.workout_id;

    // Insert exercises into workout_exercises
    const insertPromises = exercises.map(({ exercise_id, sets }) => {
      return sets.map(({ weight, reps, rir }) => {
        return db.query(
          'INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, rir) VALUES ($1, $2, $3, $4, $5, $6)',
          [workoutId, exercise_id, sets.length, reps, weight, rir]
        );
      });
    });

    await Promise.all(insertPromises.flat());

    res.status(201).json({
      message: 'Workout created successfully.',
      workout: {
        ...workout,
        exercises,
      },
    });
  } catch (err) {
    console.error('Error creating workout:', err.message);
    res.status(500).json({
      message: 'An error occurred while creating the workout.',
      details: err.message,
    });
  }
};



// Get workout history for the logged-in user
const getWorkoutHistory = async (req, res) => {
  const userId = req.user.user_id; // Get user ID from the authenticated token

  try {
    const { rows: workouts } = await db.query(
      `
            SELECT w.workout_id, w.name, w.date, w.notes
            FROM Workouts w
            WHERE w.user_id = $1
            ORDER BY w.date DESC
            `,
      [userId]
    );

    if (workouts.length === 0) {
      return res.status(404).json({ message: 'No workouts found for this user.' });
    }

    res.status(200).json(workouts);
  } catch (err) {
    console.error('Error fetching workout history:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};



// Get details of a specific workout
const getWorkoutDetails = async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid workout ID: ID must be a number.' });
  }

  try {
    const { rows: workoutRows } = await db.query(
      'SELECT * FROM Workouts WHERE workout_id = $1',
      [id]
    );
    const workout = workoutRows[0];

    if (!workout) {
      return res.status(404).json({ message: 'Workout not found' });
    }

    const { rows: exercises } = await db.query(
      `
            SELECT e.name AS exercise_name, we.reps, we.sets, we.weight
            FROM Workout_Exercises we
            JOIN Exercises e ON we.exercise_id = e.exercise_id
            WHERE we.workout_id = $1
            `,
      [id]
    );

    res.status(200).json({ ...workout, exercises });
  } catch (err) {
    console.error('Error fetching workout details:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
// Get public workout history for a specific user
const getPublicWorkoutHistory = async (req, res) => {
  const { id: userId } = req.params;

  try {
    const { rows: workouts } = await db.query(
      `
            SELECT w.workout_id, w.name, uw.status, uw.assigned_at, uw.completed_at
            FROM User_Workouts uw
            JOIN Workouts w ON uw.workout_id = w.workout_id
            WHERE uw.user_id = $1 AND w.is_global = true
            ORDER BY uw.completed_at DESC
            `,
      [userId]
    );
    res.status(200).json(workouts);
  } catch (err) {
    console.error('Error fetching public workout history:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get workouts per week for the logged-in user
const getWorkoutsPerWeek = async (req, res) => {
  const userId = req.user.user_id;

  try {
    const { rows: data } = await db.query(
      `
            SELECT DATE_TRUNC('week', uw.completed_at) AS week,
                   COUNT(*) AS workout_count
            FROM User_Workouts uw
            WHERE uw.user_id = $1 AND uw.completed_at IS NOT NULL
            GROUP BY week
            ORDER BY week ASC
            `,
      [userId]
    );
    res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching workouts per week:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Fetch all assigned workouts for the logged-in user
const getAssignedWorkouts = async (req, res) => {
  const userId = req.user?.user_id; // Get user ID from token middleware

  if (!userId) {
    console.error('User ID is missing from the request.');
    return res.status(400).json({ message: 'User ID is required.' });
  }

  // Log the user ID for debugging
  console.log('Fetching assigned workouts for user ID:', userId);

  const query = `
      SELECT uw.id AS assignment_id, 
             w.workout_id, 
             w.name, 
             w.date, 
             w.notes, 
             uw.assigned_by, 
             uw.status, 
             uw.assigned_at, 
             uw.completed_at
      FROM user_workouts uw
      JOIN workouts w ON uw.workout_id = w.workout_id
      WHERE uw.user_id = $1
      ORDER BY uw.assigned_at DESC
    `;

  console.log('Query:', query);

  try {
    // Query to fetch assigned workouts
    const { rows: assignedWorkouts } = await db.query(query, [userId]);

    // Log the result for debugging
    console.log('Assigned workouts fetched:', assignedWorkouts);

    if (assignedWorkouts.length === 0) {
      return res.status(404).json({ message: 'No assigned workouts found.' });
    }

    // Return the fetched workouts
    res.status(200).json(assignedWorkouts);
  } catch (err) {
    console.error('Error fetching assigned workouts:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};







const createAndAssignWorkout = async (req, res) => {
  const trainerId = req.user.user_id; // Assuming the trainer is logged in
  const { userId, workoutDetails } = req.body;

  const { name, date, notes, exercises } = workoutDetails;

  if (!userId || !name || !Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ message: 'Invalid input. Ensure all fields are provided.' });
  }

  try {
    // Step 1: Create the workout
    const { rows: workoutRows } = await db.query(
      `INSERT INTO Workouts (user_id, name, date, notes) 
         VALUES ($1, $2, $3, $4) 
         RETURNING workout_id`,
      [trainerId, name, date || new Date(), notes]
    );

    const workoutId = workoutRows[0].workout_id;

    // Step 2: Insert exercises into Workout_Exercises
    const insertExercises = exercises.map(({ exercise_id, sets, reps, weight }) =>
      db.query(
        `INSERT INTO Workout_Exercises (workout_id, exercise_id, sets, reps, weight)
           VALUES ($1, $2, $3, $4, $5)`,
        [workoutId, exercise_id, sets, reps, weight]
      )
    );
    await Promise.all(insertExercises);

    // Step 3: Assign the workout to the user
    await db.query(
      `INSERT INTO User_Workouts (user_id, workout_id, assigned_by, status, assigned_at) 
         VALUES ($1, $2, $3, 'assigned', NOW())`,
      [userId, workoutId, trainerId]
    );

    res.status(201).json({ message: 'Workout created and assigned successfully.' });
  } catch (err) {
    console.error('Error creating and assigning workout:', err.message);
    res.status(500).json({ message: 'An error occurred while creating and assigning the workout.' });
  }
};

const getExerciseProgress = async (req, res) => {
  const { exerciseId } = req.params;
  const userId = req.user?.user_id;

  if (!exerciseId || !userId) {
    return res.status(400).json({ message: 'Exercise ID and User ID are required.' });
  }

  try {
    const { rows } = await db.query(
      `
        SELECT we.weight, we.reps, w.date
        FROM workout_exercises we
        JOIN workouts w ON we.workout_id = w.workout_id
        WHERE we.exercise_id = $1 AND w.user_id = $2
        ORDER BY w.date ASC
        `,
      [exerciseId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No progress data found for this exercise.' });
    }

    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching exercise progress:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};


// Get suggested weights for each participant in a workout
const getSuggestedWeights = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const { workoutId } = req.params;

  if (!workoutId) {
    return res.status(400).json({ message: "Workout ID is required." });
  }

  try {
    const query = `
        SELECT 
            u.user_id,
            u.level,
            i.sex,
            e.exercise_id,
            e.name AS exercise_name,
            -- 🔥 Determine Suggested Weight Based on User's History or Default
            COALESCE(
                (
                    SELECT we.weight * 1.05  
                    FROM workout_exercises we
                    JOIN workouts w ON we.workout_id = w.workout_id
                    WHERE w.user_id = u.user_id 
                    AND we.exercise_id = e.exercise_id
                    ORDER BY w.date DESC 
                    LIMIT 1
                ),
                CASE 
                    WHEN u.level = 'Untrained' THEN 
                        CASE WHEN i.sex = 2 THEN e.men_starterweight ELSE e.women_starterweight END
                    WHEN u.level = 'Novice' THEN 
                        CASE WHEN i.sex = 2 THEN e.men_starterweight ELSE e.women_starterweight END
                    WHEN u.level = 'Intermediate' THEN 
                        CASE WHEN i.sex = 2 THEN e.men_intermediateweight ELSE e.women_intermediateweight END
                    WHEN u.level = 'Advanced' THEN 
                        CASE WHEN i.sex = 2 THEN e.men_advancedweight ELSE e.women_advancedweight END
                    WHEN u.level = 'Elite' THEN 
                        CASE WHEN i.sex = 2 THEN e.men_advancedweight * 1.25 ELSE e.women_advancedweight * 1.25 END
                    ELSE NULL
                END
            ) AS suggested_weight
        FROM public.users u
        JOIN intake i ON u.user_id = i.user_id 
        JOIN group_workout_participants gwp ON u.user_id = gwp.user_id 
        JOIN group_workouts gw ON gwp.group_workout_id = gw.group_workout_id 
        JOIN group_workout_exercises gwe ON gw.group_workout_id = gwe.group_workout_id 
        JOIN exercises e ON gwe.exercise_id = e.exercise_id 
        WHERE gw.group_workout_id = $1
        ORDER BY u.user_id, e.exercise_id;
    `;

    const { rows } = await db.query(query, [workoutId]);

    console.log("🔍 Suggested Weights Query Result:", rows);

    res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Error fetching suggested weights:', err.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};



module.exports = {
  getWorkouts,
  createWorkout,
  getWorkoutHistory,
  getWorkoutDetails,
  getPublicWorkoutHistory,
  getWorkoutsPerWeek,
  getAssignedWorkouts,
  createAndAssignWorkout,
  getExerciseProgress,
  getSuggestedWeights
};
