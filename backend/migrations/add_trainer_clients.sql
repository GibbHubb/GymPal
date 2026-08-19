-- G12 — Trainer-client pivot table.
-- Many-to-many: a client may belong to multiple trainers; a trainer manages
-- many clients. Status lets a trainer archive a client without deleting
-- history. Unique pair so the same trainer can't link the same client twice.

CREATE TABLE IF NOT EXISTS trainer_clients (
  id              SERIAL PRIMARY KEY,
  trainer_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  client_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  status          VARCHAR(16) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'archived')),
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT trainer_clients_unique UNIQUE (trainer_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer
  ON trainer_clients (trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_trainer_clients_client
  ON trainer_clients (client_id, status);
