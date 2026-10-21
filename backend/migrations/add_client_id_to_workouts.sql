-- G59 — the column the sync code actually uses.
--
-- add_client_id_to_workout_logs.sql put client_id on `workout_logs`, a table no code reads or
-- writes. createWorkout (controllers/workoutsController.js) dedupes queued offline syncs on
-- `workouts.client_id`; on a database without it every sync carrying a client_id 500s and
-- stays in the client's queue for ever.
--
-- Idempotent (IF NOT EXISTS), additive and nullable: safe on a database that already has the
-- column, and rows written without a client_id are untouched. Partial unique index, matching
-- the workout_logs one: any number of NULLs, one row per client_id.

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS client_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_client_id ON workouts(client_id) WHERE client_id IS NOT NULL;
