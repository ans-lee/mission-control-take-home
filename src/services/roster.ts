import { z } from 'zod';
import { getDb } from '../db/client.js';
import type { Actor } from './auth.js';
import { assertSameOrg } from './auth.js';
import { dateSchema, assertDateRange, levelSchema } from '../schemas.js';

// ---- Skill catalog (director writes, all reads scoped) ----

export const createSkillSchema = z.object({ name: z.string().min(1).max(50) });

export function createSkill(name: string, actor: Actor) {
  const clean = name.trim().toLowerCase();
  const id = `sk_${actor.org_id}_${clean.replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;
  try {
    getDb()
      .prepare('INSERT INTO skills (id, org_id, name) VALUES (?, ?, ?)')
      .run(id, actor.org_id, clean);
  } catch (e: any) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      throw { statusCode: 409, code: 'CONFLICT', message: 'skill already exists' };
    }
    throw e;
  }
  return { id, name: clean };
}

// ---- Crew skills: own or director ----

export const setSkillsSchema = z.object({
  skills: z.array(z.object({ skill_id: z.string().min(1), level: levelSchema })).min(1).max(50),
});

export function setUserSkills(targetId: string, skills: { skill_id: string; level: number }[], actor: Actor) {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!target) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, target.org_id);
  if (actor.id !== targetId && actor.role !== 'director') {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'only own skills or director' };
  }
  const tx = db.transaction(() => {
    for (const s of skills) {
      const skill = db
        .prepare('SELECT * FROM skills WHERE id = ? AND org_id = ?')
        .get(s.skill_id, actor.org_id) as any;
      if (!skill) throw { statusCode: 404, code: 'NOT_FOUND', message: `skill ${s.skill_id} not found` };
      db.prepare(
        `INSERT INTO crew_skills (user_id, skill_id, level) VALUES (?, ?, ?)
         ON CONFLICT (user_id, skill_id) DO UPDATE SET level = excluded.level`,
      ).run(targetId, s.skill_id, s.level);
    }
  });
  tx();
  return db.prepare('SELECT skill_id, level FROM crew_skills WHERE user_id = ?').all(targetId);
}

export function getUserProfile(targetId: string, actor: Actor) {
  const db = getDb();
  const target = db.prepare('SELECT id, org_id, role, name FROM users WHERE id = ?').get(targetId) as any;
  if (!target) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, target.org_id);
  if (actor.id !== targetId && actor.role !== 'lead' && actor.role !== 'director') {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'limited visibility' };
  }
  const skills = db
    .prepare(
      `SELECT cs.skill_id, s.name, cs.level FROM crew_skills cs
       JOIN skills s ON s.id = cs.skill_id WHERE cs.user_id = ?`,
    )
    .all(targetId);
  return { ...target, skills };
}

// ---- Availability blocks: own, director override for delete/view ----

export const createBlockSchema = z.object({
  start_date: dateSchema,
  end_date: dateSchema,
  reason: z.string().max(200).optional(),
});

export function createBlock(input: z.infer<typeof createBlockSchema>, actor: Actor) {
  assertDateRange(input.start_date, input.end_date);
  const id = `blk_${Math.random().toString(36).slice(2, 10)}`;
  getDb()
    .prepare(
      'INSERT INTO availability_blocks (id, user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, actor.id, input.start_date, input.end_date, input.reason ?? null);
  return { id, user_id: actor.id, ...input };
}

export function listBlocks(actor: Actor, queryUserId?: string) {
  const db = getDb();
  const targetId = queryUserId ?? actor.id;
  if (targetId !== actor.id && actor.role !== 'lead' && actor.role !== 'director') {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'limited visibility' };
  }
  if (targetId !== actor.id) {
    const target = db.prepare('SELECT org_id FROM users WHERE id = ?').get(targetId) as any;
    if (!target) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
    assertSameOrg(actor.org_id, target.org_id);
  }
  return db
    .prepare('SELECT * FROM availability_blocks WHERE user_id = ? ORDER BY start_date')
    .all(targetId);
}

export function deleteBlock(blockId: string, actor: Actor) {
  const db = getDb();
  const block = db.prepare('SELECT * FROM availability_blocks WHERE id = ?').get(blockId) as any;
  if (!block) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  const owner = db.prepare('SELECT org_id FROM users WHERE id = ?').get(block.user_id) as any;
  if (!owner) throw { statusCode: 404, code: 'NOT_FOUND', message: 'not found' };
  assertSameOrg(actor.org_id, owner.org_id);
  if (actor.id !== block.user_id && actor.role !== 'director') {
    throw { statusCode: 403, code: 'FORBIDDEN', message: 'only own blocks or director' };
  }
  db.prepare('DELETE FROM availability_blocks WHERE id = ?').run(blockId);
  return { deleted: blockId };
}
