import { getDb } from '../db/client.js';
import type { Actor } from './auth.js';
import { assertSameOrg } from './auth.js';

export interface MatchResult {
  user_id: string;
  name: string;
  score: number;
  breakdown: { skill: number; workload: number };
  gaps: string[];
}

interface ReqRow {
  skill_id: string;
  skill_name: string;
  min_level: number;
  min_count: number;
}

/** Overlap test (inclusive YYYY-MM-DD): NOT (a.end < b.start OR a.start > b.end) */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return !(aEnd < bStart || aStart > bEnd);
}

export function getMatches(missionId: string, actor: Actor): MatchResult[] {
  const db = getDb();
  const mission = db
    .prepare('SELECT * FROM missions WHERE id = ?')
    .get(missionId) as any;
  if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, mission.org_id);

  // Matcher locked after approval (DESIGN.md Section 6).
  if (mission.status !== 'draft' && mission.status !== 'proposed') {
    throw {
      statusCode: 409,
      code: 'INVALID_TRANSITION',
      message: `matcher only in draft|proposed, mission is ${mission.status}`,
    };
  }

  const reqs = db
    .prepare(
      `SELECT r.skill_id, s.name AS skill_name, r.min_level, r.min_count
       FROM mission_requirements r JOIN skills s ON s.id = r.skill_id
       WHERE r.mission_id = ?`,
    )
    .all(missionId) as ReqRow[];
  if (reqs.length === 0) return [];

  const candidates = db
    .prepare('SELECT id, name FROM users WHERE org_id = ? ORDER BY id')
    .all(actor.org_id) as { id: string; name: string }[];

  const skillStmt = db.prepare('SELECT skill_id, level FROM crew_skills WHERE user_id = ?');
  const blockStmt = db.prepare('SELECT start_date, end_date FROM availability_blocks WHERE user_id = ?');
  const busyStmt = db.prepare(
    `SELECT m.start_date, m.end_date FROM assignments a
     JOIN missions m ON m.id = a.mission_id
     WHERE a.user_id = ? AND a.status = 'accepted' AND m.status IN ('approved','active')`,
  );
  const activeCountStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM assignments a
     JOIN missions m ON m.id = a.mission_id
     WHERE a.user_id = ? AND a.status = 'accepted' AND m.status IN ('approved','active')`,
  );

  const out: MatchResult[] = [];

  for (const u of candidates) {
    const skills = new Map<string, number>(
      (skillStmt.all(u.id) as { skill_id: string; level: number }[]).map((r) => [
        r.skill_id,
        r.level,
      ]),
    );

    // Hard filter: zero overlapping required skills (has skill row at any level).
    if (!reqs.some((r) => skills.has(r.skill_id))) continue;

    // Hard filter: availability block overlap.
    const blocks = blockStmt.all(u.id) as { start_date: string; end_date: string }[];
    if (blocks.some((b) => overlaps(mission.start_date, mission.end_date, b.start_date, b.end_date))) {
      continue;
    }

    // Hard filter: busy via accepted assignments (proposed does NOT block).
    const busy = busyStmt.all(u.id) as { start_date: string; end_date: string }[];
    if (busy.some((b) => overlaps(mission.start_date, mission.end_date, b.start_date, b.end_date))) {
      continue;
    }

    // Skill 0.75: per-req min(level/min_level,1.2)/1.2, 0 if missing, averaged.
    let skillSum = 0;
    const gaps: string[] = [];
    for (const r of reqs) {
      const lvl = skills.get(r.skill_id);
      if (lvl === undefined) {
        skillSum += 0;
        gaps.push(`${r.skill_name}: need L${r.min_level} x${r.min_count}, have L0`);
      } else {
        skillSum += Math.min(lvl / r.min_level, 1.2) / 1.2;
        if (lvl < r.min_level) {
          gaps.push(`${r.skill_name}: need L${r.min_level} x${r.min_count}, have L${lvl}`);
        }
      }
    }
    const skill = skillSum / reqs.length;

    // Workload 0.25: 1/(1+active).
    const n = (activeCountStmt.get(u.id) as { n: number }).n;
    const workload = 1 / (1 + n);

    const score = Math.round((0.75 * skill + 0.25 * workload) * 1000) / 1000;
    out.push({
      user_id: u.id,
      name: u.name,
      score,
      breakdown: {
        skill: Math.round(skill * 1000) / 1000,
        workload: Math.round(workload * 1000) / 1000,
      },
      gaps,
    });
  }

  out.sort((a, b) => b.score - a.score || (a.user_id < b.user_id ? -1 : 1));
  return out;
}
