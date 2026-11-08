import { getDb, resetDb } from '../src/db/client.js';

export type Role = 'director' | 'lead' | 'crew';

export function reset() {
  resetDb();
}

export function addOrg(id: string, name = id) {
  getDb().prepare('INSERT INTO organisations (id, name) VALUES (?, ?)').run(id, name);
}

export function addUser(id: string, org_id: string, role: Role, name = id) {
  getDb()
    .prepare('INSERT INTO users (id, org_id, role, name) VALUES (?, ?, ?, ?)')
    .run(id, org_id, role, name);
}

export function addSkill(id: string, org_id: string, name: string) {
  getDb().prepare('INSERT INTO skills (id, org_id, name) VALUES (?, ?, ?)').run(id, org_id, name);
}

export function setCrewSkill(user_id: string, skill_id: string, level: number) {
  getDb()
    .prepare('INSERT INTO crew_skills (user_id, skill_id, level) VALUES (?, ?, ?)')
    .run(user_id, skill_id, level);
}

export function addMission(opts: {
  id: string;
  org_id: string;
  title?: string;
  status?: string;
  start?: string;
  end?: string;
  created_by: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO missions (id, org_id, title, status, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      opts.id,
      opts.org_id,
      opts.title ?? opts.id,
      opts.status ?? 'draft',
      opts.start ?? '2026-12-01',
      opts.end ?? '2026-12-10',
      opts.created_by,
    );
}

export function addRequirement(mission_id: string, skill_id: string, min_level: number, min_count = 1) {
  getDb()
    .prepare(
      'INSERT INTO mission_requirements (mission_id, skill_id, min_level, min_count) VALUES (?, ?, ?, ?)',
    )
    .run(mission_id, skill_id, min_level, min_count);
}

export function addBlock(id: string, user_id: string, start: string, end: string, reason = 'test') {
  getDb()
    .prepare(
      'INSERT INTO availability_blocks (id, user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, user_id, start, end, reason);
}

export function addAssignment(
  id: string,
  mission_id: string,
  user_id: string,
  status: 'proposed' | 'accepted' | 'declined' = 'proposed',
) {
  getDb()
    .prepare('INSERT INTO assignments (id, mission_id, user_id, status) VALUES (?, ?, ?, ?)')
    .run(id, mission_id, user_id, status);
}
