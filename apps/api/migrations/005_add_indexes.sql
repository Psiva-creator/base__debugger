-- ─────────────────────────────────────────────
-- Production Indexes Migration
-- ─────────────────────────────────────────────
-- Run: psql -d chronovm -f migrations/005_add_indexes.sql
-- ─────────────────────────────────────────────
-- Most of these were already created in earlier
-- migrations. This file consolidates and ensures
-- all production-required indexes exist.
-- ─────────────────────────────────────────────

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);

-- Memberships
CREATE INDEX IF NOT EXISTS idx_memberships_user ON project_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_project ON project_memberships (project_id);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_project ON templates (project_id, layout_version DESC);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_logs (project_id, created_at DESC);

-- Snapshots
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_creator ON snapshots (created_by);
