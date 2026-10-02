-- G50 — the minimum schema the request-level authorization tests need.
--
-- The repo has no base-schema migration (backend/migrations/ only holds `add_*` deltas on
-- top of a database that was created by hand), so this file reconstructs just the tables
-- the tested routes read, with the columns their SQL names. It is NOT the production
-- schema and must not be applied anywhere but a disposable test database.
--
-- trainer_clients and body_metrics are copied from their real migrations
-- (add_trainer_clients.sql, add_body_metrics.sql) so the link semantics under test are the
-- real ones.

DROP TABLE IF EXISTS workout_exercises, workouts, exercises, body_metrics, lifestyle_data, intake,
  trainer_clients, users CASCADE;

CREATE TABLE users (
  user_id         SERIAL PRIMARY KEY,
  username        VARCHAR(255) UNIQUE NOT NULL,
  password        TEXT NOT NULL,
  role            VARCHAR(32) NOT NULL DEFAULT 'client',
  email           TEXT,
  full_name       TEXT,
  expo_push_token TEXT
);

CREATE TABLE trainer_clients (
  id              SERIAL PRIMARY KEY,
  trainer_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  client_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  status          VARCHAR(16) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'archived')),
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT trainer_clients_unique UNIQUE (trainer_id, client_id)
);

CREATE TABLE intake (
  intake_id          SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  client_name        TEXT,
  sex                TEXT,
  age                INTEGER,
  fat_percentage     NUMERIC,
  height_cm          NUMERIC,
  weight_category    TEXT,
  bmi                NUMERIC,
  ffmi               NUMERIC,
  athleticism_score  NUMERIC,
  movement_shoulder  TEXT,
  movement_hips      TEXT,
  movement_ankles    TEXT,
  movement_thoracic  TEXT,
  genetics           TEXT
);

CREATE TABLE lifestyle_data (
  lifestyle_id      SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  date              TIMESTAMP NOT NULL DEFAULT NOW(),
  stress            INTEGER,
  sleep             NUMERIC,
  soreness          INTEGER,
  calories          INTEGER,
  weight            NUMERIC,
  notes_to_trainer  TEXT
);

CREATE TABLE body_metrics (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  weight          NUMERIC(6, 2) NOT NULL CHECK (weight > 0 AND weight < 700),
  body_fat_pct    NUMERIC(4, 2) CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  notes           TEXT,
  logged_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- G48 — what POST /api/workouts (workoutsController.createWorkout) writes and reads.
CREATE TABLE exercises (
  exercise_id     SERIAL PRIMARY KEY,
  name            TEXT NOT NULL
);

CREATE TABLE workouts (
  workout_id      SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name            TEXT,
  date            TIMESTAMP,
  notes           TEXT,
  client_id       UUID UNIQUE
);

CREATE TABLE workout_exercises (
  id              SERIAL PRIMARY KEY,
  workout_id      INTEGER NOT NULL REFERENCES workouts(workout_id) ON DELETE CASCADE,
  exercise_id     INTEGER NOT NULL REFERENCES exercises(exercise_id),
  sets            INTEGER,
  reps            NUMERIC,
  weight          NUMERIC,
  rir             NUMERIC
);
