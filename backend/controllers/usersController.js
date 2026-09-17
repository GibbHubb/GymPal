const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// G46 — the required-secret check moved to config.validate(), called at startup in
// app.js, so it names every missing variable instead of exiting from inside a require.

// Helper function to generate Access Token
const generateAccessToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    process.env.JWT_SECRET, // This should match the key used in `jwt.verify`
    { expiresIn: config.jwtExpiresIn }
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
  // G44 — this handed the whole Users table (user_id, username, role) to any
  // authenticated caller. Return only rows the caller may see: a client sees only
  // themselves; a trainer sees themselves plus their ACTIVE trainer_clients.
  const me = req.user && req.user.user_id;
  const role = req.user && req.user.role;
  if (!me) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  const isTrainer = role === 'pt' || role === 'masterPt' || role === 'trainer';
  // Optional paging + username search, used by /users/all (20 per page, as the screen expects).
  // Without ?page the full scoped list is returned, as GET /users/ always did.
  const page = Number.parseInt(req.query && req.query.page, 10);
  const search = (req.query && typeof req.query.search === 'string') ? req.query.search.trim() : '';
  const PAGE_SIZE = 20;
  try {
    const params = [me];
    let where = isTrainer
      ? `(user_id = $1 OR user_id IN (
            SELECT client_id FROM trainer_clients WHERE trainer_id = $1 AND status = 'active'))`
      : 'user_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND username ILIKE $${params.length}`;
    }
    let sql = `SELECT user_id, username, role FROM Users WHERE ${where} ORDER BY user_id`;
    if (Number.isInteger(page) && page >= 1) {
      params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }
    const { rows } = await db.query(sql, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Fetch User Profile
const getUserProfile = async (req, res) => {
  try {
    // G55 — /users/:user_id reads the requested id (the route's guard has already allowed it);
    // /users/me has no param and reads the caller.
    const user_id = req.params && req.params.user_id !== undefined
      ? Number(req.params.user_id)
      : req.user.user_id;

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

// G2 — Save Expo push token for the authenticated user
const savePushToken = async (req, res) => {
  const { user_id } = req.user;
  const { expo_push_token } = req.body;
  if (!expo_push_token) {
    return res.status(400).json({ message: 'expo_push_token is required' });
  }
  try {
    await db.query(
      'UPDATE users SET expo_push_token = $1 WHERE user_id = $2',
      [expo_push_token, user_id],
    );
    res.status(200).json({ message: 'Push token saved.' });
  } catch (err) {
    console.error('Error saving push token:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  loginUser,
  createUser,
  getUsers,
  getUserProfile,
  authenticateToken,
  refreshToken,
  savePushToken,
  generateAccessToken, // G46 — exported so the configured lifetime can be tested
};
