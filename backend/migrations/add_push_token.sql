-- Migration: add expo_push_token to users table
-- Run once: psql $DATABASE_URL -f migrations/add_push_token.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
