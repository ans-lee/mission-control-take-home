import { z } from 'zod';
import { getDb } from '../db/client.js';
import { newId } from '../db/ids.js';
import type { Actor } from './auth.js';
import { assertSameOrg } from './auth.js';
import { getMatches } from './matcher.js';

export const requirementSchema = z.object({
  skill: z.string().min(1),
  min_level: z.number().int().min(1).max(5),
  min_count: z.number().int().min(1).max(20),
});

export function addRequirement(missionId: string, input: z.infer<typeof requirementSchema>, actor: Actor) {
  const db = getDb();
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as any;
  if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, mission.org_id);
  if (mission.status !== 'draft' && mission.status !== 'proposed') {
    throw { statusCode: 409, code: 'INVALID_TRANSITION', message: 'requirements editable in draft|proposed only' };
  }

  // Resolve skill by id first, then by lowercased name (catalog stores lowercase).
  const key = input.skill.trim();
  const skill =
    (db.prepare('SELECT * FROM skills WHERE id = ? AND org_id = ?').get(key, actor.org_id) as any) ??
    (db.prepare('SELECT * FROM skills WHERE name = ? AND org_id = ?').get(key.toLowerCase(), actor.org_id) as any);
  if (!skill) throw { statusCode: 404, code: 'NOT_FOUND', message: 'skill not found' };

  db.prepare(
    `INSERT INTO mission_requirements (mission_id, skill_id, min_level, min_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (mission_id, skill_id) DO UPDATE SET min_level = excluded.min_level, min_count = excluded.min_count`,
  ).run(missionId, skill.id, input.min_level, input.min_count);
  return { mission_id: missionId, skill_id: skill.id, ...input };
}

export function removeRequirement(missionId: string, skill: string, actor: Actor) {
  const db = getDb();
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as any;
  if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, mission.org_id);
  if (mission.status !== 'draft' && mission.status !== 'proposed') {
    throw { statusCode: 409, code: 'INVALID_TRANSITION', message: 'requirements editable in draft|proposed only' };
  }
  const key = skill.trim();
  const row =
    (db.prepare('SELECT * FROM skills WHERE id = ? AND org_id = ?').get(key, actor.org_id) as any) ??
    (db.prepare('SELECT * FROM skills WHERE name = ? AND org_id = ?').get(key.toLowerCase(), actor.org_id) as any);
  if (!row) throw { statusCode: 404, code: 'NOT_FOUND', message: 'skill not found' };
  const del = db
    .prepare('DELETE FROM mission_requirements WHERE mission_id = ? AND skill_id = ?')
    .run(missionId, row.id);
  if (del.changes === 0) throw { statusCode: 404, code: 'NOT_FOUND', message: 'requirement not found' };
  return { deleted: row.id };
}

export const proposeSchema = z.object({
  mission_id: z.string().min(1),
  user_id: z.string().min(1),
});

export function proposeAssignment(input: z.infer<typeof proposeSchema>, actor: Actor) {
  const db = getDb();
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(input.mission_id) as any;
  if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, mission.org_id);
  if (mission.status !== 'draft' && mission.status !== 'proposed') {
    throw { statusCode: 409, code: 'INVALID_TRANSITION', message: `propose only in draft|proposed` };
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(input.user_id) as any;
  if (!user) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, user.org_id);

  // Snapshot matcher score/reasons at propose time. Manual override allowed (score null).
  let score: number | null = null;
  let reasons: string | null = null;
  try {
    const match = getMatches(mission.id, actor).find((m) => m.user_id === user.id);
    if (match) {
      score = match.score;
      reasons = JSON.stringify({ breakdown: match.breakdown, gaps: match.gaps });
    } else {
      reasons = JSON.stringify({ note: 'manual override: user filtered by matcher' });
    }
  } catch {
    reasons = JSON.stringify({ note: 'manual override' });
  }

  const id = newId('asg_');
  try {
    db.prepare(
      `INSERT INTO assignments (id, mission_id, user_id, status, score, reasons)
       VALUES (?, ?, ?, 'proposed', ?, ?)`,
    ).run(id, mission.id, user.id, score, reasons);
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      throw { statusCode: 409, code: 'CONFLICT', message: 'assignment already exists' };
    }
    throw e;
  }
  return db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
}

export const respondSchema = z.object({ accept: z.boolean() });
export function respondToAssignment(assignmentId: string, accept: boolean, actor: Actor) {
  const db = getDb();
  const asg = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as any;
  if (!asg) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(asg.mission_id) as any;
  if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, mission.org_id);

  // Owner or director override (checked before phase so strangers get 403, not 409).
  if (actor.role !== 'director' && asg.user_id !== actor.id) {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'only assignee or director' };
  }

  if (!['proposed', 'approved', 'active'].includes(mission.status)) {
    throw { statusCode: 409, code: 'INVALID_TRANSITION', message: `respond only in proposed|approved|active` };
  }

  const next = accept ? 'accepted' : 'declined';
  db.prepare('UPDATE assignments SET status = ? WHERE id = ?').run(next, assignmentId);
  return db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
}

/** Scoped assignment list. Crew sees own only; lead/director see org-wide, optional mission filter. */
export function listAssignments(actor: Actor, filter?: { mission_id?: string; mine?: boolean }): unknown[] {
  const db = getDb();
  if (filter?.mission_id) {
    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(filter.mission_id) as any;
    if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
    assertSameOrg(actor.org_id, mission.org_id);
    if (actor.role === 'crew') {
      return db
        .prepare('SELECT * FROM assignments WHERE mission_id = ? AND user_id = ? ORDER BY id')
        .all(filter.mission_id, actor.id);
    }
    if (filter.mine) {
      return db
        .prepare('SELECT * FROM assignments WHERE mission_id = ? AND user_id = ? ORDER BY id')
        .all(filter.mission_id, actor.id);
    }
    return db
      .prepare('SELECT * FROM assignments WHERE mission_id = ? ORDER BY id')
      .all(filter.mission_id);
  }
  if (actor.role === 'crew' || filter?.mine) {
    return db
      .prepare(
        `SELECT a.* FROM assignments a JOIN missions m ON m.id = a.mission_id
         WHERE a.user_id = ? AND m.org_id = ? ORDER BY a.id`,
      )
      .all(actor.id, actor.org_id);
  }
  return db
    .prepare(
      `SELECT a.* FROM assignments a JOIN missions m ON m.id = a.mission_id
       WHERE m.org_id = ? ORDER BY a.id`,
    )
    .all(actor.org_id);
}
