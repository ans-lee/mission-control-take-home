import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { closeDb } from '../src/db/client.js';
import { reset, addOrg, addUser, addSkill, addBlock } from './helpers.js';

process.env.MC_DB = ':memory:';
afterAll(() => closeDb());

beforeEach(() => {
  reset();
  addOrg('orga', 'A');
  addOrg('orgb', 'B');
  addUser('orga-director', 'orga', 'director');
  addUser('orga-lead-1', 'orga', 'lead');
  addUser('orga-crew-1', 'orga', 'crew', 'Cora');
  addUser('orga-crew-2', 'orga', 'crew', 'Cyrus');
  addUser('orgb-director', 'orgb', 'director');
  addSkill('orga-skill-piloting', 'orga', 'piloting');
});

const as = (u: string) => ({ 'x-user-id': u });

describe('roster', () => {
  it('skills: director creates, lead 403, duplicate 409, scoped', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST', url: '/skills', headers: as('orga-director'),
      payload: { name: 'EVA' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().skill.name).toBe('eva');

    const lead = await app.inject({
      method: 'POST', url: '/skills', headers: as('orga-lead-1'),
      payload: { name: 'medical' },
    });
    expect(lead.statusCode).toBe(403);

    const dup = await app.inject({
      method: 'POST', url: '/skills', headers: as('orga-director'),
      payload: { name: 'piloting' },
    });
    expect(dup.statusCode).toBe(409);

    const list = await app.inject({ method: 'GET', url: '/skills', headers: as('orga-lead-1') });
    expect(list.json().skills.map((s: any) => s.name)).toContain('piloting');
  });

  it('crew skills: own ok, stranger 403, director override ok', async () => {
    const app = buildServer();
    const own = await app.inject({
      method: 'PATCH', url: '/users/orga-crew-1/skills', headers: as('orga-crew-1'),
      payload: { skills: [{ skill_id: 'orga-skill-piloting', level: 3 }] },
    });
    expect(own.statusCode).toBe(200);

    const stranger = await app.inject({
      method: 'PATCH', url: '/users/orga-crew-1/skills', headers: as('orga-crew-2'),
      payload: { skills: [{ skill_id: 'orga-skill-piloting', level: 5 }] },
    });
    expect(stranger.statusCode).toBe(403);

    const dir = await app.inject({
      method: 'PATCH', url: '/users/orga-crew-1/skills', headers: as('orga-director'),
      payload: { skills: [{ skill_id: 'Piloting', level: 5 }] },
    });
    expect(dir.statusCode).toBe(200);

    const profile = await app.inject({
      method: 'GET', url: '/users/orga-crew-1', headers: as('orga-crew-1'),
    });
    expect(profile.json().user.skills[0].level).toBe(5);
  });

  it('availability: own CRUD, director delete override, bad range 400', async () => {
    const app = buildServer();
    const bad = await app.inject({
      method: 'POST', url: '/availability', headers: as('orga-crew-1'),
      payload: { start_date: '2026-12-10', end_date: '2026-12-01' },
    });
    expect(bad.statusCode).toBe(400);

    const single = await app.inject({
      method: 'POST', url: '/availability', headers: as('orga-crew-1'),
      payload: { start_date: '2026-12-01', end_date: '2026-12-01' },
    });
    expect(single.statusCode).toBe(200);

    const created = await app.inject({
      method: 'POST', url: '/availability', headers: as('orga-crew-1'),
      payload: { start_date: '2026-12-01', end_date: '2026-12-03', reason: 'rest' },
    });
    const id = created.json().block.id;

    const otherDel = await app.inject({
      method: 'DELETE', url: `/availability/${id}`, headers: as('orga-crew-2'),
    });
    expect(otherDel.statusCode).toBe(403);

    const dirDel = await app.inject({
      method: 'DELETE', url: `/availability/${id}`, headers: as('orga-director'),
    });
    expect(dirDel.json().deleted).toBe(id);
  });
});
