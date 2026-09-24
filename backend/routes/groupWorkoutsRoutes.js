const express = require('express');
const {
    getGroupWorkouts,
    getGroupWorkoutDetails,
    createGroupWorkout,
    editGroupWorkout, // ✅ New
    finishGroupWorkout, // ✅ New
    getWorkoutsByLevel,
    getLast10Workouts,
    getYourWorkouts,
    getMostUsedWorkouts,
    searchWorkouts
} = require('../controllers/groupWorkoutsController');
const { authenticateToken } = require('../controllers/usersController');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/groupWorkouts');

const router = express.Router();

// Group Workout Routes
router.get('/level', authenticateToken, getWorkoutsByLevel);
router.get('/your', authenticateToken, getYourWorkouts);
router.get('/last10', authenticateToken, getLast10Workouts); // G44 — was unauthenticated
router.get('/most-used', authenticateToken, getMostUsedWorkouts); // G44 — was unauthenticated
router.get('/search', authenticateToken, searchWorkouts);
router.get('/:id', authenticateToken, getGroupWorkoutDetails);
router.post('/', authenticateToken, validate(schemas.createGroupWorkout), createGroupWorkout);
router.post('/edit/:id', authenticateToken, validate(schemas.editGroupWorkout), editGroupWorkout); // ✅ Edit Workout Route
router.post('/finish/:id', authenticateToken, validate(schemas.finishGroupWorkout), finishGroupWorkout); // ✅ Finish Workout Route
router.get('/', authenticateToken, getGroupWorkouts);

module.exports = router;
