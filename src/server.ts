import Fastify from 'fastify';
import { z } from 'zod';
import { auth, requireRole } from './services/auth.js';
import { newId } from './db/ids.js';
import { listOrgUsers, listOrgMissions, listOrgCrew, listOrgSkills, requireOrgMission } from './db/queries.js';
import { transition, createMission, ACTIONS } from './services/mission.js';
import { getMatches } from './services/matcher.js';
import {
  addRequirement, requirementSchema,
  proposeAssignment, proposeSchema,
  respondToAssignment, respondSchema,
} from './services/assignments.js';
import {
  createSkill, createSkillSchema, setUserSkills, setSkillsSchema,
  getUserProfile, createBlock, createBlockSchema, listBlocks, deleteBlock,
} from './services/roster.js';
import { dateSchema, assertDateRange } from './schemas.js';

const createMissionSchema = z.object({
  title: z.string().min(1).max(200),
  start_date: dateSchema,
  end_date: dateSchema,
});

export function buildServer() {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err: any, _req, reply) => {
    const status = err.statusCode ?? 500;
    const code = err.code ?? (status === 500 ? 'INTERNAL' : 'ERROR');
    reply.status(status).send({ error: { code, message: err.message ?? 'error' } });
  });

  // All routes require auth. Attaches req.actor.
  app.addHook('onRequest', auth);

  // Scoped user list for CLI --as discovery. Same org only.
  app.get('/users', async (req) => {
    return { users: listOrgUsers(req.actor.org_id) };
  });

  // Missions scoped to actor org.
  app.get('/missions', async (req) => {
    return { missions: listOrgMissions(req.actor.org_id) };
  });

  app.get('/missions/:id', async (req, _reply) => {
    const { id } = req.params as { id: string };
    return { mission: requireOrgMission(id, req.actor.org_id) };
  });

  // Create -> draft. org_id always from actor. lead+ only.
  app.post('/missions', { preHandler: requireRole('lead') }, async (req) => {
    const parsed = createMissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    const { title, start_date, end_date } = parsed.data;
    try {
      assertDateRange(start_date, end_date);
    } catch {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: 'start_date > end_date' };
    }
    const mission = createMission(req.actor, {
      id: newId('m_'),
      title,
      start_date,
      end_date,
    });
    return { mission };
  });

  // Lifecycle transitions. lead+ only, SoD enforced inside transition().
  // Routes derive from TABLE keys so adding an action needs no glue edit.
  for (const action of ACTIONS) {
    app.post(`/missions/:id/${action}`, { preHandler: requireRole('lead') }, async (req) => {
      const { id } = req.params as { id: string };
      const mission = transition(id, action, req.actor);
      return { mission };
    });
  }

  // Matcher: lead+ only, draft|proposed only (409 after approval).
  app.get('/missions/:id/matches', { preHandler: requireRole('lead') }, async (req) => {
    const { id } = req.params as { id: string };
    return { matches: getMatches(id, req.actor) };
  });

  // Requirements: lead+ only. Body {skill (name or id), min_level, min_count}.
  app.post('/missions/:id/requirements', { preHandler: requireRole('lead') }, async (req) => {
    const { id } = req.params as { id: string };
    const parsed = requirementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    return { requirement: addRequirement(id, parsed.data, req.actor) };
  });

  // Propose: lead+ only, draft|proposed only. Snapshots matcher score/reasons.
  app.post('/assignments', { preHandler: requireRole('lead') }, async (req) => {
    const parsed = proposeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    return { assignment: proposeAssignment(parsed.data, req.actor) };
  });

  // Respond: assignee own or director override. Mission in proposed|approved|active.
  app.post('/assignments/:id/respond', async (req) => {
    const { id } = req.params as { id: string };
    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    return { assignment: respondToAssignment(id, parsed.data.accept, req.actor) };
  });

  // Skills catalog: reads scoped to org; writes director-only.
  app.get('/skills', async (req) => {
    return { skills: listOrgSkills(req.actor.org_id) };
  });
  app.post('/skills', { preHandler: requireRole('director') }, async (req) => {
    const parsed = createSkillSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    return { skill: createSkill(parsed.data.name, req.actor) };
  });

  // Crew: scoped list + profile (own or lead+).
  app.get('/crew', async (req) => {
    return { crew: listOrgCrew(req.actor.org_id) };
  });
  app.get('/users/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { user: getUserProfile(id, req.actor) };
  });
  app.patch('/users/:id/skills', async (req) => {
    const { id } = req.params as { id: string };
    const parsed = setSkillsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    return { skills: setUserSkills(id, parsed.data.skills, req.actor) };
  });

  // Availability: own blocks; lead/director may view others via ?user_id.
  app.get('/availability', async (req) => {
    const q = req.query as { user_id?: string };
    return { blocks: listBlocks(req.actor, q.user_id) };
  });
  app.post('/availability', async (req) => {
    const parsed = createBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      throw { statusCode: 400, code: 'BAD_REQUEST', message: parsed.error.message };
    }
    try {
      return { block: createBlock(parsed.data, req.actor) };
    } catch (e: any) {
      if (e?.message?.includes('range')) {
        throw { statusCode: 400, code: 'BAD_REQUEST', message: e.message };
      }
      throw e;
    }
  });
  app.delete('/availability/:id', async (req) => {
    const { id } = req.params as { id: string };
    return deleteBlock(id, req.actor);
  });

  return app;
}

const isMain = process.argv[1]?.endsWith('server.ts');
if (isMain) {
  const app = buildServer();
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).then(() => {
    console.log(`api listening on :${port}`);
  });
}
