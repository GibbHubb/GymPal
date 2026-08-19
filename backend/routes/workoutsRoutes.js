const express = require('express');
const {
    getWorkouts,
    createWorkout,
    getWorkoutHistory,
    getWorkoutDetails,
    getAssignedWorkouts,
    getExerciseProgress,
    getPrBaselines,      // G38 — batch PR baselines
    getSuggestedWeights, // Add new function here
    getClientStats,      // G11 — trainer dashboard
    getVolumeHeatmap,    // G15 — weekly volume heatmap
    getLastWorkout,      // G30 — repeat last
} = require('../controllers/workoutsController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// Define routes
router.get('/', authenticateToken, getWorkouts);
router.post('/', authenticateToken, createWorkout);
router.get('/history', authenticateToken, getWorkoutHistory);
// G11 — must register before /:id so it isn't shadowed
router.get('/trainer/client-stats', authenticateToken, getClientStats);
// G15 — must register before /:id so it isn't shadowed
router.get('/heatmap', authenticateToken, getVolumeHeatmap);
// G30 — must register before /:id so it isn't shadowed
router.get('/last', authenticateToken, getLastWorkout);
router.get('/assigned', authenticateToken, getAssignedWorkouts);
router.get('/progress/:exerciseId', authenticateToken, getExerciseProgress);
// G38 — batch baselines for PR detection; POST because the id list can be long.
// Registered before /:id so it isn't shadowed.
router.post('/pr-baselines', authenticateToken, getPrBaselines);
router.get('/suggested-weights/:workoutId', authenticateToken, getSuggestedWeights); // New route
router.get('/:id', authenticateToken, getWorkoutDetails);

module.exports = router;
