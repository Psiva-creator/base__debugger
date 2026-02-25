-- ─────────────────────────────────────────────
-- Snapshots Migration
-- ─────────────────────────────────────────────
-- Run: psql -d chronovm -f migrations/004_create_snapshots.sql
-- ─────────────────────────────────────────────

CREATE TYPE snapshot_visibility AS ENUM ('private', 'public');

CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    visibility snapshot_visibility NOT NULL DEFAULT 'private',

    source_code TEXT NOT NULL,
    compiler_version TEXT NOT NULL,

    template_snapshot JSONB NOT NULL,
    override_snapshot JSONB,

    execution_hash TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,

    micro_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE rules enforced at application layer
-- (PostgreSQL rules/triggers could be added for extra safety)

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_creator ON snapshots (created_by);
