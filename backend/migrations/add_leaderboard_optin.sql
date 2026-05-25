-- G31 — public weekly leaderboard, opt-in flag on users.
-- Default false: nobody is on the board unless they say so.
-- Run once: psql $DATABASE_URL -f migrations/add_leaderboard_optin.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
