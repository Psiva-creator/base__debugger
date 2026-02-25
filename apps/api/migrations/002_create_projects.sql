-- ─────────────────────────────────────────────
-- Projects + Memberships Migration
-- ─────────────────────────────────────────────
-- Run: psql -d chronovm -f migrations/002_create_projects.sql
-- ─────────────────────────────────────────────

-- Role enum
CREATE TYPE project_role AS ENUM (
    'owner',
    'instructor',
    'maintainer',
    'viewer'
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_code TEXT NOT NULL,
    compiler_version TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);

-- Memberships table (composite PK)
CREATE TABLE IF NOT EXISTS project_memberships (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role project_role NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON project_memberships (user_id);
