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
