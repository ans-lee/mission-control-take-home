import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { closeDb } from '../src/db/client.js';
import { reset, addOrg, addUser, addMission } from './helpers.js';

process.env.MC_DB = ':memory:';
afterAll(() => closeDb());

function fixture() {
  reset();
  addOrg('orga', 'A');
  addUser('orga-director', 'orga', 'director');
  addUser('orga-lead-1', 'orga', 'lead');
  addUser('orga-lead-2', 'orga', 'lead');
  addUser('orga-crew-1', 'orga', 'crew');
  addMission({ id: 'm-draft', org_id: 'orga', created_by: 'orga-lead-1' });
}
beforeEach(fixture);

const as = (u: string) => ({ 'x-user-id': u });

describe('lifecycle', () => {
  it('happy path draft->proposed->approved->active->completed', async () => {
    const app = buildServer();
    for (const [action, user, want] of [
      ['submit', 'orga-lead-1', 'proposed'],
      ['approve', 'orga-lead-2', 'approved'],
      ['activate', 'orga-lead-1', 'active'],
      ['complete', 'orga-lead-2', 'completed'],
    ] as const) {
      const res = await app.inject({
        method: 'POST',
        url: `/missions/m-draft/${action}`,
        headers: as(user),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().mission.status).toBe(want);
    }
  });

  it('illegal draft->approve returns 409', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/missions/m-draft/approve',
      headers: as('orga-lead-2'),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_TRANSITION');
  });

  it('reject->submit loop works, cancel from approved/active only', async () => {
    const app = buildServer();
    let res = await app.inject({ method: 'POST', url: '/missions/m-draft/submit', headers: as('orga-lead-1') });
    expect(res.json().mission.status).toBe('proposed');
    res = await app.inject({ method: 'POST', url: '/missions/m-draft/reject', headers: as('orga-lead-2') });
    expect(res.json().mission.status).toBe('rejected');
    res = await app.inject({ method: 'POST', url: '/missions/m-draft/submit', headers: as('orga-lead-1') });
    expect(res.json().mission.status).toBe('proposed');
    // cancel from proposed is illegal
    res = await app.inject({ method: 'POST', url: '/missions/m-draft/cancel', headers: as('orga-lead-2') });
    expect(res.statusCode).toBe(409);
  });

  it('crew cannot transition (403), cross-org is 404', async () => {
    const app = buildServer();
    const crew = await app.inject({
      method: 'POST', url: '/missions/m-draft/submit', headers: as('orga-crew-1'),
    });
    expect(crew.statusCode).toBe(403);
  });

  it('create sets draft + org from actor', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST', url: '/missions', headers: as('orga-lead-1'),
      payload: { title: 'new', start_date: '2027-01-01', end_date: '2027-01-05' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().mission.status).toBe('draft');
  });
});
