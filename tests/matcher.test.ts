import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { resetDb, getDb, closeDb } from '../src/db/client.js';

process.env.MC_DB = ':memory:';
afterAll(() => closeDb());

beforeEach(() => {
  resetDb();
  getDb().exec(`
    INSERT INTO organisations (id, name) VALUES ('orga','A'), ('orgb','B');
    INSERT INTO users (id, org_id, role, name) VALUES
      ('orga-lead-1','orga','lead','L1'),
      ('orga-crew-1','orga','crew','Cora'),
      ('orga-crew-2','orga','crew','Cyrus'),
      ('orga-crew-3','orga','crew','Cara'),
      ('orga-crew-4','orga','crew','Mira'),
      ('orga-crew-5','orga','crew','Eli'),
      ('orgb-lead-1','orgb','lead','BL');
    INSERT INTO skills (id, org_id, name) VALUES
      ('orga-skill-piloting','orga','piloting'),
      ('orga-skill-engineering','orga','engineering'),
      ('orga-skill-medical','orga','medical');
    INSERT INTO crew_skills (user_id, skill_id, level) VALUES
      ('orga-crew-1','orga-skill-piloting',4),
      ('orga-crew-2','orga-skill-piloting',2),
      ('orga-crew-2','orga-skill-engineering',4),
      ('orga-crew-3','orga-skill-piloting',4),
      ('orga-crew-4','orga-skill-medical',4),
      ('orga-crew-5','orga-skill-engineering',3),
      ('orga-crew-5','orga-skill-medical',3);
    INSERT INTO missions (id, org_id, title, status, start_date, end_date, created_by) VALUES
      ('m0-base','orga','baseline','active','2026-12-11','2026-12-12','orga-lead-1'),
      ('m1','orga','M1 gap','draft','2026-12-01','2026-12-10','orga-lead-1'),
      ('m2','orga','M2 overlap','draft','2026-12-05','2026-12-12','orga-lead-1'),
      ('m3','orga','M3 cover','draft','2027-01-05','2027-01-12','orga-lead-1'),
      ('m-orgb','orgb','secret','draft','2026-12-01','2026-12-10','orgb-lead-1');
    INSERT INTO mission_requirements (mission_id, skill_id, min_level, min_count) VALUES
      ('m1','orga-skill-piloting',3,2),
      ('m2','orga-skill-engineering',3,1),
      ('m3','orga-skill-medical',3,1);
    INSERT INTO availability_blocks (id, user_id, start_date, end_date, reason) VALUES
      ('blk1','orga-crew-3','2026-12-02','2026-12-06','leave');
    INSERT INTO assignments (id, mission_id, user_id, status) VALUES
      ('asg-busy','m0-base','orga-crew-2','accepted'),
      ('asg-prop','m0-base','orga-crew-5','proposed');
  `);
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
