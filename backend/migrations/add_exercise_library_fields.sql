-- G13 — Exercise library hardening.
-- The `exercises` table + CRUD pre-dates this ticket (table created during
-- earlier GymPal work; `name`, `muscle_group`, `difficulty` already exist).
-- This migration adds the four fields the structured library actually needs:
--   equipment             — text (e.g. 'barbell', 'dumbbell', 'bodyweight')
--   video_url             — optional YouTube/Vimeo link, no upload
--   default_rest_seconds  — used by G14's rest timer (replaces hardcoded 90s)
--   is_global             — true = bundled seed, false = trainer-created custom
--
-- Idempotent (safe to re-run).

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS equipment            VARCHAR(40),
  ADD COLUMN IF NOT EXISTS video_url            TEXT,
  ADD COLUMN IF NOT EXISTS default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS is_global            BOOLEAN NOT NULL DEFAULT FALSE;

-- The legacy `muscle_group` column stays as the primary-muscle field.
-- Casting it NOT NULL on existing rows is risky if any are NULL — leave as-is.

CREATE INDEX IF NOT EXISTS idx_exercises_is_global ON exercises (is_global);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises (muscle_group);
