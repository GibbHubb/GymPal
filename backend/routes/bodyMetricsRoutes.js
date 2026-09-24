const express = require('express');
const { createBodyMetric, getBodyMetrics } = require('../controllers/bodyMetricsController');
const { authenticateToken } = require('../controllers/usersController');
const { requireSelfOrLinkedTrainer } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/bodyMetrics');

const router = express.Router();

// G10 — all body-metrics routes require auth
router.post('/', authenticateToken, validate(schemas.createBodyMetric), createBodyMetric);
// G44 — the controller's own check passed for ANY trainer role, not one linked to
// this client. The middleware enforces the active trainer_clients link.
router.get('/:userId', authenticateToken, requireSelfOrLinkedTrainer('userId'), getBodyMetrics);

module.exports = router;
