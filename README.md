# GymPal

A full-stack fitness and training platform with dedicated portals for clients and trainers. Built with React Native + Expo on the frontend and Node.js + Express on a Railway-hosted backend. Features real-time trainer sessions via Socket.IO, role-based auth, workout management, and lifestyle/intake tracking.

---

## Features

**Client portal**
- Dashboard with quick-access to all training modules
- Intake forms — body stats, goals, dietary preferences
- Lifestyle tracking — sleep, energy, activity logs
- Training plan viewer — assigned workouts with sets/reps
- Progress visualisation — charts built with `react-native-chart-kit`

**Trainer portal**
- Client overview — see all assigned clients and their status
- Workout builder — create and edit structured workout plans with exercises
- Global state management for real-time trainer ↔ client sync
- TV/Streaming mode — full-screen session view for in-gym display
- Socket.IO event handlers for live session updates

**Platform**
- JWT auth with role-based routing (client/trainer split at login)
- Session persistence via AsyncStorage
- Centralised Axios instance with automatic 401 logout handling
- Railway-hosted backend — always-on, no local server needed

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile framework | React Native 0.76 + Expo 52 |
| Navigation | React Navigation (Stack) |
| HTTP client | Axios (Railway backend) |
| Real-time | Socket.IO client |
| Charts | react-native-chart-kit + react-native-svg |
| Auth | JWT (decoded client-side with jwt-decode) |
| Session storage | AsyncStorage |
| Backend runtime | Node.js + Express |
| Database | PostgreSQL (Railway managed) |
| Auth backend | bcrypt + JWT signing |
| Deployment | Railway |

---

## Project Structure

```
gympal/
├── screens/
│   ├── Client/
│   │   ├── ClientHome.js        # Client dashboard
│   │   ├── IntakeScreen.js      # Body stats & goals
│   │   ├── LifestyleScreen.js   # Daily logs
│   │   ├── TrainingScreen.js    # Workout plans
│   │   └── ProgressScreen.js   # Progress charts
│   └── Trainer/
│       ├── TrainerHome.js       # Trainer dashboard
│       ├── ClientOverview.js    # Client management
│       ├── CreateWorkout.js     # Workout builder
│       ├── EditWorkout.js       # Edit existing workouts
│       ├── WorkoutsMenu.js      # Workout library
│       ├── TVScreen.js          # Full-screen session mode
│       └── GlobalState.js       # Shared trainer state
├── components/
│   ├── CustomButton.js
│   ├── CustomInput.js
│   ├── CustomHeader.js
│   ├── GlassCard.js
│   └── ScreenWrapper.js
├── constants/
│   └── Theme.js                 # Dark/Gold design tokens (#F6B000)
├── backend/
│   ├── app.js                   # Express server entry
│   ├── routes/                  # REST API routes
│   │   ├── usersRoutes.js
│   │   ├── workoutsRoutes.js
│   │   ├── exercisesRoutes.js
│   │   ├── intakeRoutes.js
│   │   ├── lifestyleDataRoutes.js
│   │   └── groupWorkoutsRoutes.js
│   ├── controllers/             # Route handlers
│   ├── models/db.js             # PostgreSQL connection
│   ├── middleware/              # Auth middleware
│   ├── config/config.js         # Env config
│   └── socket-io-handlers.js    # Real-time events
├── api.js                       # Centralised Axios client
├── docs/
│   ├── erd.png                  # Entity relationship diagram
│   └── constaints.csv           # Schema constraints
└── utils/RootNavigation.js
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (or a simulator)

### Frontend setup

```bash
git clone https://github.com/GibbHubb/GymPal.git
cd GymPal
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for Android / iOS simulator.

The app connects to the production Railway backend by default — no local server needed to run the frontend.

### Backend setup (local dev)

```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm start              # runs on port 5000
```

Update `api.js` → `API_URL` to point at `http://localhost:5000/api` for local development.

#### Required environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default: 7d) |
| `NODE_ENV` | `development` or `production` |

### Tests

Two suites, both vitest, both run by CI (`.github/workflows/ci.yml`) on every push and PR:

```bash
npm test                 # the app suite (utils/, config/)
npm --prefix backend test   # the backend suite
```

The backend's request-level authorization tests (`backend/test/`) drive the real app against a
real, disposable Postgres. Without `TEST_DATABASE_URL` they are skipped locally (CI refuses to
skip them):

```bash
docker run -d --name gympal-test-pg -e POSTGRES_USER=gympal -e POSTGRES_PASSWORD=gympal \
  -e POSTGRES_DB=gympal_test -p 55432:5432 postgres:16-alpine
TEST_DATABASE_URL=postgres://gympal:gympal@127.0.0.1:55432/gympal_test npm --prefix backend test
```

The database must be local and its name must end in `_test`: the fixtures drop and recreate their tables.

---

## Design System

All styling flows from `constants/Theme.js`. The Dark/Gold theme uses:

- **Background:** `#0D0D0D` — near-black surface
- **Accent:** `#F6B000` — GymPal Gold
- **Glass cards:** semi-transparent with blur for depth
- **Inputs:** transparent with gold underline/focus states
- **Typography:** consistent weight scale, white on dark

No third-party UI library — every component is hand-built to the spec.

---

## Offline-first Architecture

GymPal workouts are logged offline-first — they are always saved locally before any network call is attempted.

### Sync Queue (`utils/syncQueue.js`)

Each workout is persisted to `AsyncStorage` under the key `hai_sync_queue` as a JSON array of queue items. Every item carries:

| Field | Description |
|-------|-------------|
| `id` | Client-generated UUID v4 (used for idempotency) |
| `type` | Always `workout_log` |
| `payload` | Full workout body sent to the backend, including `client_id` |
| `status` | `pending` → `retrying` → `failed` (a synced item is removed). `failed` items are skipped by automatic syncs and retried by an explicit one (G48) |
| `attempts` | Number of sync attempts so far |
| `ownerId` | User id of the account that queued it. A sync only sends the items of the user whose token it uses; the queue survives logout, so another user's items wait for their owner (G58) |
| `createdAt` | ISO timestamp of local creation |

### Sync Engine (`utils/syncEngine.js`)

`startSyncEngine(apiBaseUrl, getAuthToken)` registers a `NetInfo` listener. When the device comes online it calls `runSync()` automatically. `runSync` can also be called manually (e.g. from a "Sync now" button).

**Retry policy:** up to 5 attempts with natural ordering (each connectivity event retries). After 5 failures the item is marked `failed` and not retried automatically.

### Idempotency

Each workout payload includes `client_id` (UUID). The backend `POST /api/workouts` route checks for an existing row with that `client_id` before inserting:

- Match found → returns `200` with the existing row (no duplicate).
- No match → inserts normally.

The required migration is at `backend/migrations/add_client_id_to_workout_logs.sql`.

### UI indicators

- **TrainingScreen** — shows a yellow badge for pending items, green for synced, red for sync failure.
- **ClientHome** — shows a red numeric badge on the Training button when there are unsynced workouts.

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/users/register` | Register client or trainer |
| POST | `/api/users/login` | Login, returns JWT |
| GET | `/api/users/me` | Current user profile |
| GET | `/api/workouts` | List workouts for user |
| POST | `/api/workouts` | Create workout |
| PUT | `/api/workouts/:id` | Edit workout |
| GET | `/api/exercises` | Exercise library |
| POST | `/api/intake` | Submit intake form |
| GET | `/api/intake/:userId` | Get intake data |
| POST | `/api/lifestyle` | Log lifestyle data |
| GET | `/api/lifestyle/:userId` | Get lifestyle history |
| GET | `/api/health` | Health check |
