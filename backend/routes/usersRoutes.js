const express = require('express');
const {
  loginUser,
  createUser,
  getUsers,
  getUserProfile,
  refreshToken,
  authenticateToken,
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
router.get('/', authenticateToken, getUsers);

// Get the logged-in user's profile
router.get('/me', authenticateToken, getUserProfile);

router.get('/:user_id', authenticateToken, getUserProfile);

module.exports = router;
