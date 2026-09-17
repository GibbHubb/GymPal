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
const { requireSelfOrLinkedTrainer } = require('../middleware/authorize');

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

// The app's client list (ClientOverview -> fetchUsers) calls /users/all. With no route of its
// own it fell through to /:user_id and got back one profile object instead of a list. Same
// scoped list as GET /, paged and searchable. Must be registered BEFORE /:user_id.
router.get('/all', authenticateToken, getUsers);

// G55 — a profile by id: yourself, or a trainer actively linked to that client
// (ProfileScreen opens it both ways). It used to ignore the id and return the caller.
router.get('/:user_id', authenticateToken, requireSelfOrLinkedTrainer('user_id'), getUserProfile);

// G2 — Push token registration
router.post('/push-token', authenticateToken, savePushToken);

module.exports = router;
