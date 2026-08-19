const express = require('express');
const { createBodyMetric, getBodyMetrics } = require('../controllers/bodyMetricsController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// G10 — all body-metrics routes require auth
router.post('/', authenticateToken, createBodyMetric);
router.get('/:userId', authenticateToken, getBodyMetrics);

module.exports = router;
