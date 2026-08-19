-- G10 — Client body metrics log
-- Weekly weight, body fat %, and free-form notes per user.
CREATE TABLE IF NOT EXISTS body_metrics (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  weight          NUMERIC(6, 2) NOT NULL CHECK (weight > 0 AND weight < 700),
  body_fat_pct    NUMERIC(4, 2) CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  notes           TEXT,
  logged_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_body_metrics_user_logged
  ON body_metrics(user_id, logged_at DESC);
