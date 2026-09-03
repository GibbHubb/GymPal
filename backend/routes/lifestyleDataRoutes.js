const express = require('express');
const {
    getLifestyleData,
    addLifestyleData,
} = require('../controllers/lifestyleDataController');
const { authenticateToken } = require('../controllers/usersController');
const { requireSelfOrLinkedTrainer } = require('../middleware/authorize');

const router = express.Router();

// Routes for Lifestyle Data
// G44 — same IDOR shape: stress/sleep/soreness are another user's data.
router.get('/:user_id', authenticateToken, requireSelfOrLinkedTrainer('user_id'), getLifestyleData);
router.post('/', authenticateToken, addLifestyleData); // Add new lifestyle data for a user

module.exports = router;
