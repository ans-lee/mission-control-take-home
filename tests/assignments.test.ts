import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { closeDb } from '../src/db/client.js';
import {
  reset, addOrg, addUser, addSkill, setCrewSkill, addMission, addRequirement, addAssignment,
} from './helpers.js';

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
  addUser('orgb-lead-1', 'orgb', 'lead');
  addUser('orgb-crew-1', 'orgb', 'crew');
  addSkill('orga-skill-piloting', 'orga', 'piloting');
  addSkill('orgb-skill-piloting', 'orgb', 'piloting');
  setCrewSkill('orga-crew-1', 'orga-skill-piloting', 4);
  addMission({ id: 'm1', org_id: 'orga', created_by: 'orga-lead-1' });
  addRequirement('m1', 'orga-skill-piloting', 3, 1);
});

const as = (u: string) => ({ 'x-user-id': u });

describe('assignments', () => {
  it('propose snapshots matcher score; duplicate 409; locked after approval', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST', url: '/assignments', headers: as('orga-lead-1'),
      payload: { mission_id: 'm1', user_id: 'orga-crew-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.status).toBe('proposed');
    expect(res.json().assignment.score).toBeGreaterThan(0.5);

    const dup = await app.inject({
      method: 'POST', url: '/assignments', headers: as('orga-lead-1'),
      payload: { mission_id: 'm1', user_id: 'orga-crew-1' },
    });
    expect(dup.statusCode).toBe(409);

    // cross-org user -> 404
    const cross = await app.inject({
      method: 'POST', url: '/assignments', headers: as('orga-lead-1'),
      payload: { mission_id: 'm1', user_id: 'orgb-crew-1' },
    });
    expect(cross.statusCode).toBe(404);

    // lock after approval
    await app.inject({ method: 'POST', url: '/missions/m1/submit', headers: as('orga-lead-1') });
    await app.inject({ method: 'POST', url: '/missions/m1/approve', headers: as('orga-director') });
    const locked = await app.inject({
      method: 'POST', url: '/assignments', headers: as('orga-lead-1'),
      payload: { mission_id: 'm1', user_id: 'orga-crew-2' },
    });
    expect(locked.statusCode).toBe(409);
  });

  it('respond: owner ok, stranger 403, director override ok, wrong phase 409', async () => {
    const app = buildServer();
    addAssignment('asg1', 'm1', 'orga-crew-1', 'proposed');
    // move to proposed so respond is in-phase (respond blocked in draft)
    await app.inject({ method: 'POST', url: '/missions/m1/submit', headers: as('orga-lead-1') });

    const stranger = await app.inject({
      method: 'POST', url: '/assignments/asg1/respond', headers: as('orga-crew-2'),
      payload: { accept: true },
    });
    expect(stranger.statusCode).toBe(403);

    const owner = await app.inject({
      method: 'POST', url: '/assignments/asg1/respond', headers: as('orga-crew-1'),
      payload: { accept: true },
    });
    expect(owner.json().assignment.status).toBe('accepted');

    addAssignment('asg2', 'm1', 'orga-crew-2', 'proposed');
    const dir = await app.inject({
      method: 'POST', url: '/assignments/asg2/respond', headers: as('orga-director'),
      payload: { accept: false },
    });
    expect(dir.json().assignment.status).toBe('declined');
  });

  it('requirements: lead ok by name, crew 403', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST', url: '/missions/m1/requirements', headers: as('orga-lead-1'),
      payload: { skill: 'piloting', min_level: 4, min_count: 1 },
    });
    expect(res.statusCode).toBe(200);
    const crew = await app.inject({
      method: 'POST', url: '/missions/m1/requirements', headers: as('orga-crew-1'),
      payload: { skill: 'piloting', min_level: 2, min_count: 1 },
    });
    expect(crew.statusCode).toBe(403);
  });
});
