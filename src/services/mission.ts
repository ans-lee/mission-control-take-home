import { getDb } from '../db/client.js';
import type { Actor } from './auth.js';
import { assertSameOrg } from './auth.js';

// Single transition table owns Section 6 diagram. Handlers must call transition().
// Adding an action = one entry here; routes derive from ACTIONS below.
const TABLE = {
  submit: { from: ['draft', 'rejected'], to: 'proposed' },
  approve: { from: ['proposed'], to: 'approved' },
  reject: { from: ['proposed'], to: 'rejected' },
  activate: { from: ['approved'], to: 'active' },
  complete: { from: ['active'], to: 'completed' },
  cancel: { from: ['approved', 'active'], to: 'cancelled' },
} as const;

export type MissionAction = keyof typeof TABLE;
export const ACTIONS = Object.keys(TABLE) as MissionAction[];

export interface MissionRow {
  id: string;
  org_id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  created_by: string;
  submitted_by: string | null;
  approved_by: string | null;
}

export function transition(missionId: string, action: MissionAction, actor: Actor): MissionRow {
  const db = getDb();
  const mission = db
    .prepare('SELECT * FROM missions WHERE id = ?')
    .get(missionId) as MissionRow | undefined;
  if (!mission) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, mission.org_id);

  const rule = TABLE[action];
  if (!rule.from.includes(mission.status)) {
    throw {
      statusCode: 409,
      code: 'INVALID_TRANSITION',
      message: `cannot ${action} from ${mission.status}`,
    };
  }

  // SoD: no one approves/rejects their own submission (lead + director).
  if (
    (action === 'approve' || action === 'reject') &&
    mission.submitted_by === actor.id
  ) {
    throw {
      statusCode: 403,
      code: 'SELF_APPROVAL',
      message: 'cannot approve or reject own submission',
    };
  }

  let submittedBy = mission.submitted_by;
  let approvedBy = mission.approved_by;
  if (action === 'submit') {
    submittedBy = actor.id;
    approvedBy = null; // resubmit clears prior approval
  }
  if (action === 'approve') approvedBy = actor.id;

  db.prepare(
    'UPDATE missions SET status = ?, submitted_by = ?, approved_by = ? WHERE id = ?',
  ).run(rule.to, submittedBy, approvedBy, missionId);

  return db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId) as MissionRow;
}

export function createMission(
  actor: Actor,
  input: { id: string; title: string; start_date: string; end_date: string },
): MissionRow {
  const db = getDb();
  // org_id always from actor, never client (guardrail).
  db.prepare(
    `INSERT INTO missions (id, org_id, title, status, start_date, end_date, created_by)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
  ).run(input.id, actor.org_id, input.title, input.start_date, input.end_date, actor.id);
  return db.prepare('SELECT * FROM missions WHERE id = ?').get(input.id) as MissionRow;
}
