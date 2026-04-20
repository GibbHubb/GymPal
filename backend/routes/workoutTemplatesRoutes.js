const express = require('express');
const { getTemplates, createTemplate, deleteTemplate } = require('../controllers/workoutTemplatesController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

router.get('/', authenticateToken, getTemplates);
router.post('/', authenticateToken, createTemplate);
router.delete('/:id', authenticateToken, deleteTemplate);

module.exports = router;
