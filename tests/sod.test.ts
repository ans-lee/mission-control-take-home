import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { resetDb, getDb, closeDb } from '../src/db/client.js';

process.env.MC_DB = ':memory:';
afterAll(() => closeDb());

beforeEach(() => {
  resetDb();
  getDb().exec(`
    INSERT INTO organisations (id, name) VALUES ('orga','A');
    INSERT INTO users (id, org_id, role, name) VALUES
      ('orga-director','orga','director','D'),
      ('orga-lead-1','orga','lead','L1'),
      ('orga-lead-2','orga','lead','L2');
    INSERT INTO missions (id, org_id, title, status, start_date, end_date, created_by) VALUES
      ('m1','orga','M1','draft','2026-12-01','2026-12-10','orga-lead-1'),
      ('m2','orga','M2','draft','2026-12-01','2026-12-10','orga-director');
  `);
});

const as = (u: string) => ({ 'x-user-id': u });

describe('separation of duties', () => {
  it('submitter cannot approve own mission', async () => {
    const app = buildServer();
    await app.inject({ method: 'POST', url: '/missions/m1/submit', headers: as('orga-lead-1') });
    const res = await app.inject({ method: 'POST', url: '/missions/m1/approve', headers: as('orga-lead-1') });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('SELF_APPROVAL');
  });

  it('submitter cannot reject own mission', async () => {
    const app = buildServer();
    await app.inject({ method: 'POST', url: '/missions/m1/submit', headers: as('orga-lead-1') });
    const res = await app.inject({ method: 'POST', url: '/missions/m1/reject', headers: as('orga-lead-1') });
    expect(res.statusCode).toBe(403);
  });

  it('peer lead can approve', async () => {
    const app = buildServer();
    await app.inject({ method: 'POST', url: '/missions/m1/submit', headers: as('orga-lead-1') });
    const res = await app.inject({ method: 'POST', url: '/missions/m1/approve', headers: as('orga-lead-2') });
    expect(res.statusCode).toBe(200);
    expect(res.json().mission.approved_by).toBe('orga-lead-2');
  });

  it('applies to directors too', async () => {
    const app = buildServer();
    await app.inject({ method: 'POST', url: '/missions/m2/submit', headers: as('orga-director') });
    const selfApprove = await app.inject({ method: 'POST', url: '/missions/m2/approve', headers: as('orga-director') });
    expect(selfApprove.statusCode).toBe(403);
    const peer = await app.inject({ method: 'POST', url: '/missions/m2/approve', headers: as('orga-lead-1') });
    expect(peer.statusCode).toBe(200);
  });
});
