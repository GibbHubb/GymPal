const express = require('express');
const {
  listClients,
  addClient,
  updateLink,
  deleteLink,
} = require('../controllers/trainerClientsController');
const { authenticateToken } = require('../controllers/usersController');

const router = express.Router();

router.get('/', authenticateToken, listClients);
router.post('/', authenticateToken, addClient);
router.patch('/:linkId', authenticateToken, updateLink);
router.delete('/:linkId', authenticateToken, deleteLink);

module.exports = router;
