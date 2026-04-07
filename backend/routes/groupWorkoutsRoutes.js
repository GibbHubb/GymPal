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

const router = express.Router();

// Group Workout Routes
router.get('/level', authenticateToken, getWorkoutsByLevel);
router.get('/your', authenticateToken, getYourWorkouts);
router.get('/last10', getLast10Workouts);
router.get('/most-used', getMostUsedWorkouts);
router.get('/search', authenticateToken, searchWorkouts);
router.get('/:id', authenticateToken, getGroupWorkoutDetails);
router.post('/', authenticateToken, createGroupWorkout);
router.post('/edit/:id', authenticateToken, editGroupWorkout); // ✅ Edit Workout Route
router.post('/finish/:id', authenticateToken, finishGroupWorkout); // ✅ Finish Workout Route
router.get('/', authenticateToken, getGroupWorkouts);

module.exports = router;
