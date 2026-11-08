import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { closeDb } from '../src/db/client.js';
import { reset, addOrg, addUser, addMission } from './helpers.js';

process.env.MC_DB = ':memory:';

afterAll(() => closeDb());

beforeEach(() => {
  reset();
  addOrg('orga', 'A');
  addOrg('orgb', 'B');
  addUser('orga-lead-1', 'orga', 'lead');
  addUser('orga-crew-1', 'orga', 'crew');
  addUser('orgb-lead-1', 'orgb', 'lead');
  addMission({ id: 'm-a', org_id: 'orga', created_by: 'orga-lead-1' });
  addMission({ id: 'm-orgb-secret', org_id: 'orgb', created_by: 'orgb-lead-1' });
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

  it('users ?role filters, invalid role 400', async () => {
    const app = buildServer();
    const crew = await app.inject({
      method: 'GET', url: '/users?role=crew', headers: { 'x-user-id': 'orga-lead-1' },
    });
    expect(crew.json().users.map((u: any) => u.id)).toEqual(['orga-crew-1']);
    const bad = await app.inject({
      method: 'GET', url: '/users?role=admin', headers: { 'x-user-id': 'orga-lead-1' },
    });
    expect(bad.statusCode).toBe(400);
  });
});
