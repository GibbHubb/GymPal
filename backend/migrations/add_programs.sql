-- G16 — Trainer program builder: multi-week programs that stack G7 templates.
-- Three tables, all idempotent.
--
-- programs                    — top-level "Push/Pull/Legs 4-week" container
-- program_days                — sparse week×day grid; each cell points at a template
-- client_program_assignments  — which client is on which program, starting when

CREATE TABLE IF NOT EXISTS programs (
  id           SERIAL PRIMARY KEY,
  trainer_id   INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name         VARCHAR(120) NOT NULL,
  total_weeks  INTEGER NOT NULL CHECK (total_weeks BETWEEN 1 AND 52),
  description  TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_programs_trainer ON programs (trainer_id);

CREATE TABLE IF NOT EXISTS program_days (
  id           SERIAL PRIMARY KEY,
  program_id   INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL CHECK (week_number >= 1),
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0 = Sun
  template_id  INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  notes        TEXT,
  CONSTRAINT program_days_unique UNIQUE (program_id, week_number, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_program_days_program ON program_days (program_id);

CREATE TABLE IF NOT EXISTS client_program_assignments (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  program_id   INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  status       VARCHAR(16) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'paused')),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
-- A client can be re-assigned to the same program later (history matters);
-- no UNIQUE on (client, program). Today's-session resolver picks the most-
-- recent active assignment.
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON client_program_assignments (client_id, status);
CREATE INDEX IF NOT EXISTS idx_client_assignments_program ON client_program_assignments (program_id);
