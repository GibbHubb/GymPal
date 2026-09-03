const express = require('express');
const {
    getIntakeData,
    addIntakeData,
} = require('../controllers/IntakeController');
const { authenticateToken } = require('../controllers/usersController');
const { requireSelfOrLinkedTrainer } = require('../middleware/authorize');

const router = express.Router();

// Routes for Intake Data
// G44 — the GET reads another user's intake by id, so gate it on self-or-linked-trainer.
router.get('/:user_id', authenticateToken, requireSelfOrLinkedTrainer('user_id'), getIntakeData);
router.post('/', authenticateToken, addIntakeData); // Add new intake data for a user

module.exports = router;
