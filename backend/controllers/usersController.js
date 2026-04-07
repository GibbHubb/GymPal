const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Ensure secrets are available
if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  console.error('Missing JWT_SECRET or REFRESH_TOKEN_SECRET in environment variables');
  process.exit(1);
}

// Helper function to generate Access Token
const generateAccessToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    process.env.JWT_SECRET, // This should match the key used in `jwt.verify`
    { expiresIn: '15m' }
  );
};


// Helper function to generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
};

// Login User
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Fetch user details from the database
    const { rows } = await db.query('SELECT * FROM Users WHERE username = $1', [username]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Determine if user is a trainer
    const isTrainer = user.role === 'pt' || user.role === 'masterPt';

    // Return response with tokens and user details
    res.status(200).json({
      token: accessToken,
      refreshToken,
      user: {
        user_id: user.user_id, // Always return user_id
        trainer_id: isTrainer ? user.user_id : null, // Only return trainer_id for trainers
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error logging in user:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Create User
const createUser = async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await db.query(
      'INSERT INTO Users (username, password, role) VALUES ($1, $2, $3) RETURNING user_id, username, role',
      [username, hashedPassword, role || 'client']
    );

    res.status(201).json({
      message: 'User created successfully',
      user: rows[0],
    });
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Fetch All Users
const getUsers = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id, username, role FROM Users');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Fetch User Profile
const getUserProfile = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { rows } = await db.query(
      'SELECT user_id, username, role FROM Users WHERE user_id = $1',
      [user_id]
    );

    if (!rows?.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching user profile:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Middleware for Authentication


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user; // Attach decoded token payload to req.user
    next();
  });
};




// Refresh Token
const refreshToken = async (req, res) => {
  const { refreshToken: providedRefreshToken } = req.body;

  if (!providedRefreshToken) {
    return res.status(401).json({ message: 'Refresh token not provided' });
  }

  try {
    const decoded = jwt.verify(providedRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const { rows } = await db.query('SELECT * FROM Users WHERE user_id = $1', [decoded.user_id]);
    const user = rows?.[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.status(200).json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Error refreshing token:', err.message);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

module.exports = {
  loginUser,
  createUser,
  getUsers,
  getUserProfile,
  authenticateToken,
  refreshToken,
};
