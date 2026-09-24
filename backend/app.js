const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();
const db     = require('./models/db');
const config = require('./config/config');
config.validate(); // G46 — fail at boot, naming the variable, not at first request
const socketHandlers = require('./socket-io-handlers');

const app = express();
const PORT = config.port || 5000;

// G49 — Railway (and most PaaS) sit behind a reverse proxy, so req.ip is the proxy's
// address unless the app trusts X-Forwarded-For. Without this, express-rate-limit below
// sees every request as coming from one IP and locks everyone out together, or — worse —
// silently under-counts because IPv6-mapped proxy chains confuse the default key.
app.set('trust proxy', 1);

// G49 — helmet's security headers (X-Content-Type-Options, etc.). This app serves only
// JSON (no HTML/bundle is served from here — the RN/web bundle and landing page are
// deployed separately), so helmet's default CSP has nothing to break and is left on.
app.use(helmet());

// G49 — replaced `origin: true`, which reflected whatever Origin header the caller sent
// (the comment here used to claim that "accommodates credentials safely" — it does the
// opposite: origin:true + credentials:true is exactly the combination the CORS spec exists
// to prevent). Now an explicit allowlist from config.corsOrigins (see config/config.js).
// Mobile app builds send no Origin header at all and are unaffected either way.
const corsOptions = {
    origin(origin, callback) {
        // No Origin header (native apps, curl, server-to-server) — allow; there is no
        // browser enforcing same-origin here for CORS to protect against.
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

// ✅ CORS Configuration (Ensure this is before your routes)
app.use(cors(corsOptions));

// ✅ Ensure preflight requests (OPTIONS) are handled properly
app.options('*', cors(corsOptions));

// G49 — brute-force / CPU-exhaustion guard on the two auth routes that do a bcrypt
// compare or issue tokens with no other rate control. Scoped tightly (not applied
// globally) so a legitimate heavy sync session elsewhere is never throttled.
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 10,            // 10 requests/minute/IP; the 11th in the window is rejected
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Try again in a minute.' },
});
// /register belongs here too: it is unauthenticated and runs bcrypt at cost 10
// before an INSERT, which is the CPU-exhaustion shape this limiter exists for.
// One array, so the next expensive public route is an edit here rather than a
// third copied line (review, 2026-09-24).
app.use(['/api/users/login', '/api/users/refresh', '/api/users/register'], authLimiter);

// G46 — this block used to print DATABASE_URL and JWT_SECRET in plaintext on every
// boot, which on Railway lands in the deployment logs (a live secret exposure).
// Log only what is safe to see, and confirm the secrets are PRESENT without printing
// their values — an unset JWT_SECRET is itself worth surfacing.
console.log('Loaded Configuration:');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${config.nodeEnv}`);
console.log(`JWT_EXPIRES_IN: ${config.jwtExpiresIn}`);
console.log(`DATABASE_URL: ${config.databaseUrl ? '[set]' : '[MISSING]'}`);
console.log(`JWT_SECRET: ${config.jwtSecret ? '[set]' : '[MISSING]'}`);
console.log(`REFRESH_TOKEN_SECRET: ${config.refreshTokenSecret ? '[set]' : '[MISSING]'}`);

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Debugging: Log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ✅ Health Check Route
app.get('/api/health', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT NOW()');
        res.status(200).json({ status: 'OK', timestamp: rows[0].now });
    } catch (err) {
        console.error('❌ Health check failed:', err.message);
        res.status(500).json({ status: 'ERROR', details: err.message });
    }
});

// ✅ Routes (Make sure they come AFTER CORS setup)
app.use('/api/users', require('./routes/usersRoutes'));
app.use('/api/exercises', require('./routes/exercisesRoutes'));
app.use('/api/workouts', require('./routes/workoutsRoutes'));
app.use('/api/group-workouts', require('./routes/groupWorkoutsRoutes'));
app.use('/api/lifestyle-data', require('./routes/lifestyleDataRoutes'));
app.use('/api/intake', require('./routes/intakeRoutes'));
app.use('/api/templates', require('./routes/workoutTemplatesRoutes'));
app.use('/api/body-metrics', require('./routes/bodyMetricsRoutes'));
app.use('/api/trainer-clients', require('./routes/trainerClientsRoutes'));
app.use('/api/programs', require('./routes/programsRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));  // G31

// ✅ Catch-all for undefined routes
app.use((req, res, next) => {
    res.status(404).json({ error: '❌ Route not found' });
});

// ✅ Global Error Handling Middleware
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`[${new Date().toISOString()}] ❌ ${req.method} ${req.url} - Error ${status}: ${message}`);

    res.status(status).json({
        success: false,
        error: status === 500 ? 'Server Error' : message,
        details: config.nodeEnv === 'development' ? err.stack : undefined,
    });
});

// ✅ HTTP server + Socket.IO
const server = http.createServer(app);
// The same allowlist as the HTTP surface. `origin: true` here reflected ANY
// origin while sending credentials — the exact pattern the CORS fix above
// removed, surviving 70 lines below it on a second, unaudited path. One
// function, both surfaces (review, 2026-09-24).
const io = new Server(server, {
    cors: {
        origin:      corsOptions.origin,
        methods:     ['GET', 'POST'],
        credentials: true,
    },
});
socketHandlers(io);

// ✅ Start Server
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // G46 — was `Connected to database: ${config.databaseUrl}`, a second copy of the
    // connection string (with credentials) in the logs.
    console.log(`✅ Connected to database`);
});

// G8 — weekly summary cron
require('./jobs/weekly_summary');

module.exports = { app, server, io };
