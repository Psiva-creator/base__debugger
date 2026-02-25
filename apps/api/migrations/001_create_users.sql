-- ─────────────────────────────────────────────
-- Users Table Migration
-- ─────────────────────────────────────────────
-- Run against your PostgreSQL database:
--   psql -d chronovm -f migrations/001_create_users.sql
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
