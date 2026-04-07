const express = require('express');
const {
    getIntakeData,
    addIntakeData,
} = require('../controllers/IntakeController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// Routes for Intake Data
router.get('/:user_id', authenticateToken, getIntakeData); // Fetch intake data for a specific user
router.post('/', authenticateToken, addIntakeData); // Add new intake data for a user

module.exports = router;
