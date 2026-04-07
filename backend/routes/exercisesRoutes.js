const express = require('express');
const {
    getExercises,
    createExercise,
    getExerciseById,
    updateExercise,
    deleteExercise,
    searchExercises,
} = require('../controllers/exercisesController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// Exercise Routes
router.get('/search', authenticateToken, searchExercises); // Search exercises
router.get('/', authenticateToken, getExercises); // Fetch all exercises
router.post('/', authenticateToken, createExercise); // Add a new exercise
router.get('/:id', authenticateToken, getExerciseById); // Fetch exercise by ID
router.put('/:id', authenticateToken, updateExercise); // Update an exercise
router.delete('/:id', authenticateToken, deleteExercise); // Delete an exercise

module.exports = router;
