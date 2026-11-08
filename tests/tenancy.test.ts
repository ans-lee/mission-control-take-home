import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { resetDb, getDb, closeDb } from '../src/db/client.js';

process.env.MC_DB = ':memory:';

afterAll(() => closeDb());

beforeEach(() => {
  resetDb();
  const db = getDb();
  // Minimal two-tenant fixture (full story lives in seed.ts).
  db.exec(`
    INSERT INTO organisations (id, name) VALUES ('orga','A'), ('orgb','B');
    INSERT INTO users (id, org_id, role, name) VALUES
      ('orga-lead-1','orga','lead','L1'), ('orga-crew-1','orga','crew','C1'),
      ('orgb-lead-1','orgb','lead','BL1');
    INSERT INTO missions (id, org_id, title, status, start_date, end_date, created_by) VALUES
      ('m-a','orga','A mission','draft','2026-12-01','2026-12-10','orga-lead-1'),
      ('m-orgb-secret','orgb','secret','draft','2026-12-01','2026-12-10','orgb-lead-1');
  `);
});

describe('tenancy', () => {
  it('401 without x-user-id', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/missions' });
    expect(res.statusCode).toBe(401);
  });

  it('cross-org fetch returns 404, not 403 (no probe)', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/missions/m-orgb-secret',
      headers: { 'x-user-id': 'orga-lead-1' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('lists are scoped to actor org', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/missions',
      headers: { 'x-user-id': 'orga-lead-1' },
    });
    const body = res.json();
    expect(body.missions.map((m: any) => m.id)).toEqual(['m-a']);
  });
});
