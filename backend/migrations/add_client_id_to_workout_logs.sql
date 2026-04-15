ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS client_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_client_id ON workout_logs(client_id) WHERE client_id IS NOT NULL;
