-- Mission Control schema v1
-- Conventions (per DESIGN.md + discussion):
--   IDs: readable TEXT PKs (e.g. 'orga-lead-1'). Demo auth uses x-user-id directly.
--   Dates: TEXT 'YYYY-MM-DD', inclusive calendar days, UTC. Lexicographic compare == chronological.
--   All tenant scoping via org_id on users/skills/missions. Never trust client org.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organisations (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id     TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role   TEXT NOT NULL CHECK (role IN ('director','lead','crew')),
  name   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

CREATE TABLE IF NOT EXISTS skills (
  id     TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name   TEXT NOT NULL,
  UNIQUE (org_id, name)
);

-- Proficiency 1-5. PK(user_id, skill_id).
CREATE TABLE IF NOT EXISTS crew_skills (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level    INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, skill_id)
);

-- Lifecycle: draft | proposed | approved | active | completed | rejected | cancelled
-- See DESIGN.md Section 6 state diagram. Only transition() may change status.
CREATE TABLE IF NOT EXISTS missions (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','proposed','approved','active','completed','rejected','cancelled')),
  start_date   TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date     TEXT NOT NULL CHECK (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_by   TEXT NOT NULL REFERENCES users(id),
  submitted_by TEXT REFERENCES users(id),
  approved_by  TEXT REFERENCES users(id),
  CHECK (start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS idx_missions_org_status ON missions(org_id, status);

-- Need min_count distinct crew with level >= min_level for this skill.
CREATE TABLE IF NOT EXISTS mission_requirements (
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  skill_id   TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  min_level  INTEGER NOT NULL CHECK (min_level BETWEEN 1 AND 5),
  min_count  INTEGER NOT NULL CHECK (min_count >= 1),
  PRIMARY KEY (mission_id, skill_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id         TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'proposed'
             CHECK (status IN ('proposed','accepted','declined')),
  score      REAL CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  reasons    TEXT, -- JSON string: {breakdown, gaps} from matcher, nullable
  UNIQUE (mission_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_mission_user ON assignments(mission_id, user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_status ON assignments(user_id, status);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date   TEXT NOT NULL CHECK (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  reason     TEXT,
  CHECK (start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS idx_blocks_user_dates ON availability_blocks(user_id, start_date, end_date);
