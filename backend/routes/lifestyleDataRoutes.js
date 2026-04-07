const express = require('express');
const {
    getLifestyleData,
    addLifestyleData,
} = require('../controllers/lifestyleDataController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// Routes for Lifestyle Data
router.get('/:user_id', authenticateToken, getLifestyleData); // Fetch lifestyle data for a specific user
router.post('/', authenticateToken, addLifestyleData); // Add new lifestyle data for a user

module.exports = router;
