-- ─────────────────────────────────────────────
-- Templates + Audit Logs Migration
-- ─────────────────────────────────────────────
-- Run: psql -d chronovm -f migrations/003_create_templates.sql
-- ─────────────────────────────────────────────

-- Versioned template snapshots (INSERT-only, never UPDATE)
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    layout_version INT NOT NULL,
    panel_modes JSONB NOT NULL,
    locked_panels JSONB NOT NULL,
    template_hash TEXT NOT NULL,
    previous_hash TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (project_id, layout_version)
);

CREATE INDEX IF NOT EXISTS idx_templates_project ON templates (project_id, layout_version DESC);

-- Append-only audit log with hash chain
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role TEXT NOT NULL,
    action_type TEXT NOT NULL,
    changed_keys JSONB,
    before_state JSONB,
    after_state JSONB,
    layout_version INT,
    previous_hash TEXT,
    hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_logs (project_id, created_at DESC);
