const express = require('express');
const {
    getWorkouts,
    createWorkout,
    getWorkoutHistory,
    getWorkoutDetails,
    getAssignedWorkouts,
    getExerciseProgress,
    getSuggestedWeights, // Add new function here
} = require('../controllers/workoutsController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// Define routes
router.get('/', authenticateToken, getWorkouts);
router.post('/', authenticateToken, createWorkout);
router.get('/history', authenticateToken, getWorkoutHistory);
router.get('/:id', authenticateToken, getWorkoutDetails);
router.get('/assigned', authenticateToken, getAssignedWorkouts);
router.get('/progress/:exerciseId', authenticateToken, getExerciseProgress);
router.get('/suggested-weights/:workoutId', authenticateToken, getSuggestedWeights); // New route

module.exports = router;
