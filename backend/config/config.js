require('dotenv').config(); // Load .env variables into process.env

// The longest an ACCESS token may live. Refresh tokens are separate (7d, in the
// controller) — this cap is only about the short-lived credential sent on every request.
const ACCESS_TOKEN_MAX_SECONDS = 60 * 60; // 1 hour
const DEFAULT_ACCESS_TOKEN_TTL = '15m';

/** Parse a jsonwebtoken-style duration ('900', '15m', '2h', '7d') to seconds; null if unparseable. */
function ttlSeconds(value) {
    if (value === undefined || value === null || value === '') return null;
    const m = String(value).trim().match(/^(\d+)\s*([smhd])?$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 's').toLowerCase();
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
}

/** The configured access-token lifetime, refused if it exceeds the cap. */
function safeAccessTokenTtl(raw) {
    const secs = ttlSeconds(raw);
    if (raw === undefined || raw === '') return DEFAULT_ACCESS_TOKEN_TTL;
    if (secs === null) {
        console.warn(`JWT_EXPIRES_IN="${raw}" is not a duration — using ${DEFAULT_ACCESS_TOKEN_TTL}`);
        return DEFAULT_ACCESS_TOKEN_TTL;
    }
    if (secs > ACCESS_TOKEN_MAX_SECONDS) {
        console.warn(
            `JWT_EXPIRES_IN="${raw}" (${secs}s) exceeds the ${ACCESS_TOKEN_MAX_SECONDS}s cap for ` +
            `ACCESS tokens — using ${DEFAULT_ACCESS_TOKEN_TTL}. Set a shorter value to change it.`);
        return DEFAULT_ACCESS_TOKEN_TTL;
    }
    return raw;
}

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
    //
    // 2026-09-16: CLAMPED. Making this configurable is only safe if a stale value cannot
    // silently widen the window: the old .env.example shipped `JWT_EXPIRES_IN=7d`, so a
    // deployment that copied it would have turned 15-minute access tokens into 7-day ones
    // the moment the controller started honouring this. Anything longer than
    // ACCESS_TOKEN_MAX_SECONDS is refused (with a warning) in favour of the safe default.
    jwtExpiresIn: safeAccessTokenTtl(process.env.JWT_EXPIRES_IN),
    nodeEnv: process.env.NODE_ENV || 'development', // Environment mode
    REQUIRED,
    missingRequired,
    validate,
    // exported for the tests that pin the cap
    ACCESS_TOKEN_MAX_SECONDS,
    DEFAULT_ACCESS_TOKEN_TTL,
    ttlSeconds,
    safeAccessTokenTtl,
};
