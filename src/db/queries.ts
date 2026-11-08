import { getDb } from './client.js';
import { roleSchema } from '../schemas.js';

/** Thin typed reads. All tenant scoping lives here — callers never inline org filters.
 *  DB rows are trusted (schema.sql CHECKs enforce shapes); we cast except at the
 *  auth gate below. Request/response validation stays at API boundaries via zod.
 *
 *  Scope rule: queries.ts holds reusable scoped READS only (no writes, no domain
 *  rules). State transitions stay in services/lifecycle.ts, scoring joins stay in
 *  services/matcher.ts — colocated with the invariant they enforce.
 */

export interface UserRow {
  id: string;
  org_id: string;
  role: 'director' | 'lead' | 'crew';
  name: string;
}

export function findUser(id: string): UserRow | undefined {
  const row = getDb()
    .prepare('SELECT id, org_id, role, name FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
  if (!row) return undefined;
  // Auth gate: validate role enum instead of trusting the cast.
  // A bad role here would escalate privileges, so fail closed with 500.
  const parsed = roleSchema.safeParse(row.role);
  if (!parsed.success) {
    throw { statusCode: 500, code: 'INTERNAL', message: `invalid role in db for ${id}` };
  }
  return { ...row, role: parsed.data };
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

export interface MissionScopedRow extends MissionListRow {
  org_id: string;
}

/** Returns mission or throws 404 (covers both missing + cross-org, no probing). */
export function requireOrgMission(id: string, org_id: string): MissionScopedRow {
  const row = getDb()
    .prepare('SELECT id, org_id, title, status, start_date, end_date FROM missions WHERE id = ?')
    .get(id) as MissionScopedRow | undefined;
  if (!row || row.org_id !== org_id) {
    throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  }
  return row;
}
