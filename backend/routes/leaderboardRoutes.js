const express = require('express');
const { getWeekly, setOptIn } = require('../controllers/leaderboardController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

router.get('/weekly', authenticateToken, getWeekly);
router.patch('/opt-in', authenticateToken, setOptIn);

module.exports = router;
