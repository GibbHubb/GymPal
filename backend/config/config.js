require('dotenv').config(); // Load .env variables into process.env

// G46 — the variables the server cannot run without. Checked once at startup so a
// missing one fails loudly by NAME, instead of at the first request that needs it.
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];

function missingRequired(env = process.env) {
    return REQUIRED.filter((key) => !env[key]);
}

function validate(env = process.env) {
    const missing = missingRequired(env);
    if (missing.length) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    }
}

module.exports = {
    port: process.env.PORT || 5000, // Server port
    databaseUrl: process.env.DATABASE_URL, // Database connection string
    jwtSecret: process.env.JWT_SECRET, // Secret key for access tokens
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET, // Secret key for refresh tokens
    // G46 — was '1h' here while the controller hardcoded '15m' and ignored this value.
    // The default now matches what production has actually been issuing.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m', // Access-token lifetime
    nodeEnv: process.env.NODE_ENV || 'development', // Environment mode
    REQUIRED,
    missingRequired,
    validate,
};
