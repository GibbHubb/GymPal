const express = require('express');
const {
  listClients,
  addClient,
  updateLink,
  deleteLink,
  getCompliance,  // G28
} = require('../controllers/trainerClientsController');
const { authenticateToken } = require('../controllers/usersController');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/trainerClients');

const router = express.Router();

// G28 must register before /:linkId-style routes so it isn't shadowed.
router.get('/compliance', authenticateToken, getCompliance);
router.get('/', authenticateToken, listClients);
router.post('/', authenticateToken, validate(schemas.addClient), addClient);
router.patch('/:linkId', authenticateToken, validate(schemas.updateLink), updateLink);
router.delete('/:linkId', authenticateToken, deleteLink);

module.exports = router;
