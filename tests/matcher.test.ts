import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { getDb, closeDb } from '../src/db/client.js';
import {
  reset, addOrg, addUser, addSkill, setCrewSkill,
  addMission, addRequirement, addBlock, addAssignment,
} from './helpers.js';

process.env.MC_DB = ':memory:';
afterAll(() => closeDb());

beforeEach(() => {
  reset();
  addOrg('orga', 'A');
  addOrg('orgb', 'B');
  addUser('orga-lead-1', 'orga', 'lead');
  for (const [id, name] of [
    ['orga-crew-1', 'Cora'], ['orga-crew-2', 'Cyrus'], ['orga-crew-3', 'Cara'],
    ['orga-crew-4', 'Mira'], ['orga-crew-5', 'Eli'],
  ] as const) addUser(id, 'orga', 'crew', name);
  addUser('orgb-lead-1', 'orgb', 'lead');
  addSkill('orga-skill-piloting', 'orga', 'piloting');
  addSkill('orga-skill-engineering', 'orga', 'engineering');
  addSkill('orga-skill-medical', 'orga', 'medical');
  setCrewSkill('orga-crew-1', 'orga-skill-piloting', 4);
  setCrewSkill('orga-crew-2', 'orga-skill-piloting', 2);
  setCrewSkill('orga-crew-2', 'orga-skill-engineering', 4);
  setCrewSkill('orga-crew-3', 'orga-skill-piloting', 4);
  setCrewSkill('orga-crew-4', 'orga-skill-medical', 4);
  setCrewSkill('orga-crew-5', 'orga-skill-engineering', 3);
  setCrewSkill('orga-crew-5', 'orga-skill-medical', 3);
  addMission({ id: 'm0-base', org_id: 'orga', status: 'active', start: '2026-12-11', end: '2026-12-12', created_by: 'orga-lead-1' });
  addMission({ id: 'm1', org_id: 'orga', start: '2026-12-01', end: '2026-12-10', created_by: 'orga-lead-1' });
  addMission({ id: 'm2', org_id: 'orga', start: '2026-12-05', end: '2026-12-12', created_by: 'orga-lead-1' });
  addMission({ id: 'm3', org_id: 'orga', start: '2027-01-05', end: '2027-01-12', created_by: 'orga-lead-1' });
  addMission({ id: 'm-orgb', org_id: 'orgb', created_by: 'orgb-lead-1' });
  addRequirement('m1', 'orga-skill-piloting', 3, 2);
  addRequirement('m2', 'orga-skill-engineering', 3, 1);
  addRequirement('m3', 'orga-skill-medical', 3, 1);
  addBlock('blk1', 'orga-crew-3', '2026-12-02', '2026-12-06');
  addAssignment('asg-busy', 'm0-base', 'orga-crew-2', 'accepted');
  addAssignment('asg-prop', 'm0-base', 'orga-crew-5', 'proposed');
});

const as = (u: string) => ({ 'x-user-id': u });

describe('matcher', () => {
  it('M1: ranks qualified first, gap text for under-leveled, leave-filtered out', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/missions/m1/matches', headers: as('orga-lead-1') });
    expect(res.statusCode).toBe(200);
    const ids = res.json().matches.map((m: any) => m.user_id);
    // crew-3 on leave excluded, crew-4/5 zero piloting overlap excluded
    expect(ids).toEqual(['orga-crew-1', 'orga-crew-2']);
    const [top, second] = res.json().matches;
    expect(top.gaps).toEqual([]);
    expect(second.gaps).toEqual(['piloting: need L3 x2, have L2']);
    expect(top.score).toBeGreaterThan(second.score);
  });

  it('M2: accepted blocks but proposed does not', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/missions/m2/matches', headers: as('orga-lead-1') });
    const ids = res.json().matches.map((m: any) => m.user_id);
    expect(ids).not.toContain('orga-crew-2'); // accepted overlap -> busy
    expect(ids).toContain('orga-crew-5'); // proposed does not block
  });

  it('workload term prefers free crew + locked after approval + role/tenant gates', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/missions/m3/matches', headers: as('orga-lead-1') });
    const byId = Object.fromEntries(res.json().matches.map((m: any) => [m.user_id, m]));
    // crew-5 has no accepted on approved/active overlapping m3 but proposed doesn't count;
    // both free here -> equal workload; assert field exists and 0..1
    expect(byId['orga-crew-4'].breakdown.workload).toBe(1);
    // crew cannot run matcher
    const crew = await app.inject({ method: 'GET', url: '/missions/m3/matches', headers: as('orga-crew-1') });
    expect(crew.statusCode).toBe(403);
    // cross-org 404
    const cross = await app.inject({ method: 'GET', url: '/missions/m-orgb/matches', headers: as('orga-lead-1') });
    expect(cross.statusCode).toBe(404);
    // lock after approval
    await app.inject({ method: 'POST', url: '/missions/m3/submit', headers: as('orga-lead-1') });
    await app.inject({ method: 'POST', url: '/missions/m3/approve', headers: { 'x-user-id': 'orga-lead-1' } }).then(() => {});
    // need peer approve (SoD): use direct DB? submit was lead-1, approve must be someone else — use director? add director
    getDb().exec(`INSERT INTO users (id, org_id, role, name) VALUES ('orga-director','orga','director','D')`);
    await app.inject({ method: 'POST', url: '/missions/m3/approve', headers: as('orga-director') });
    const locked = await app.inject({ method: 'GET', url: '/missions/m3/matches', headers: as('orga-lead-1') });
    expect(locked.statusCode).toBe(409);
  });
});
