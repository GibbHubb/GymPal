const express = require('express');
const { getWeekly, setOptIn } = require('../controllers/leaderboardController');
const { authenticateToken } = require('../controllers/usersController');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/leaderboard');

const router = express.Router();

router.get('/weekly', authenticateToken, getWeekly);
router.patch('/opt-in', authenticateToken, validate(schemas.setOptIn), setOptIn);

module.exports = router;
