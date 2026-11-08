import { getDb } from './client.js';

/** Thin typed reads. All tenant scoping lives here — callers never inline org filters. */

export interface UserRow {
  id: string;
  org_id: string;
  role: 'director' | 'lead' | 'crew';
  name: string;
}

export function findUser(id: string): UserRow | undefined {
  return getDb()
    .prepare('SELECT id, org_id, role, name FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
}

export function listOrgUsers(org_id: string): { id: string; name: string; role: string }[] {
  return getDb()
    .prepare('SELECT id, name, role FROM users WHERE org_id = ? ORDER BY id')
    .all(org_id) as any[];
}

export interface MissionListRow {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
}

export function listOrgMissions(org_id: string): MissionListRow[] {
  return getDb()
    .prepare(
      'SELECT id, title, status, start_date, end_date FROM missions WHERE org_id = ? ORDER BY id',
    )
    .all(org_id) as MissionListRow[];
}

/** Returns mission or throws 404 (covers both missing + cross-org, no probing). */
export function requireOrgMission(id: string, org_id: string): any {
  const row = getDb()
    .prepare('SELECT id, org_id, title, status, start_date, end_date FROM missions WHERE id = ?')
    .get(id) as any;
  if (!row || row.org_id !== org_id) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  }
  return row;
}
