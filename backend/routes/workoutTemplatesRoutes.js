const express = require('express');
const { getTemplates, createTemplate, deleteTemplate } = require('../controllers/workoutTemplatesController');
const { authenticateToken } = require('../controllers/usersController');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/workoutTemplates');

const router = express.Router();

router.get('/', authenticateToken, getTemplates);
router.post('/', authenticateToken, validate(schemas.createTemplate), createTemplate);
router.delete('/:id', authenticateToken, deleteTemplate);

module.exports = router;
