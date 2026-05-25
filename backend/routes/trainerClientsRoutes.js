const express = require('express');
const {
  listClients,
  addClient,
  updateLink,
  deleteLink,
  getCompliance,  // G28
} = require('../controllers/trainerClientsController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

// G28 must register before /:linkId-style routes so it isn't shadowed.
router.get('/compliance', authenticateToken, getCompliance);
router.get('/', authenticateToken, listClients);
router.post('/', authenticateToken, addClient);
router.patch('/:linkId', authenticateToken, updateLink);
router.delete('/:linkId', authenticateToken, deleteLink);

module.exports = router;
