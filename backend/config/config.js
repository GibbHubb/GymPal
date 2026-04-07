require('dotenv').config(); // Load .env variables into process.env

module.exports = {
    port: process.env.PORT || 5000, // Server port
    databaseUrl: process.env.DATABASE_URL, // Database connection string
    jwtSecret: process.env.JWT_SECRET, // Secret key for JWT
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h', // Optional JWT expiration time
    nodeEnv: process.env.NODE_ENV || 'development', // Environment mode
};
