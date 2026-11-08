import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { closeDb } from '../src/db/client.js';
import { reset, addOrg, addUser, addMission } from './helpers.js';

process.env.MC_DB = ':memory:';
afterAll(() => closeDb());

beforeEach(() => {
  reset();
  addOrg('orga', 'A');
  addUser('orga-director', 'orga', 'director');
  addUser('orga-lead-1', 'orga', 'lead');
  addUser('orga-lead-2', 'orga', 'lead');
  addMission({ id: 'm1', org_id: 'orga', created_by: 'orga-lead-1' });
  addMission({ id: 'm2', org_id: 'orga', created_by: 'orga-director' });
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
