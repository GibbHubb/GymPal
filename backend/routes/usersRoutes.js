const express = require('express');
const {
  loginUser,
  createUser,
  getUsers,
  getUserProfile,
  refreshToken,
  authenticateToken,
  savePushToken,
} = require('../controllers/usersController');

const router = express.Router();

/**
 * Public Routes
 */

// User login
router.post('/login', loginUser);

// Register a new user
router.post('/register', createUser);

// Refresh token
router.post('/refresh', refreshToken);

/**
 * Protected Routes (requires authentication)
 */

// Get all users
// G44 — getUsers now filters by relationship (a client sees only themselves; a
// trainer sees themselves + their active clients), so the route just needs auth.
router.get('/', authenticateToken, getUsers);

// Get the logged-in user's profile
router.get('/me', authenticateToken, getUserProfile);

router.get('/:user_id', authenticateToken, getUserProfile);

// G2 — Push token registration
router.post('/push-token', authenticateToken, savePushToken);

module.exports = router;
