import { getDb, resetDb, closeDb } from './client.js';

/**
 * Seed proving the DESIGN.md Section 10 story:
 *  M1 (2026-12-01..10) needs piloting L3 x2 but only 1 qualified -> gap demo
 *  M2 (2026-12-05..12) overlaps M1 -> double-book filter demo
 *  M3 (2027-01-05..12) fully coverable
 *  1 crew on leave overlapping M1, 1 accepted assignment overlapping M2
 */
function run(): void {
  resetDb();
  const db = getDb();

  const insertOrg = db.prepare('INSERT INTO organisations (id, name) VALUES (?, ?)');
  const insertUser = db.prepare(
    'INSERT INTO users (id, org_id, role, name) VALUES (?, ?, ?, ?)',
  );
  const insertSkill = db.prepare(
    'INSERT INTO skills (id, org_id, name) VALUES (?, ?, ?)',
  );
  const insertCrewSkill = db.prepare(
    'INSERT INTO crew_skills (user_id, skill_id, level) VALUES (?, ?, ?)',
  );
  const insertMission = db.prepare(
    `INSERT INTO missions (id, org_id, title, status, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReq = db.prepare(
    'INSERT INTO mission_requirements (mission_id, skill_id, min_level, min_count) VALUES (?, ?, ?, ?)',
  );
  const insertAsg = db.prepare(
    `INSERT INTO assignments (id, mission_id, user_id, status, score, reasons)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertBlock = db.prepare(
    'INSERT INTO availability_blocks (id, user_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)',
  );

  const seed = db.transaction(() => {
    // ---- Orgs ----
    insertOrg.run('orga', 'OrgA — Aurora Space');
    insertOrg.run('orgb', 'OrgB — Beacon Labs');

    // ---- OrgA users: 1 director, 2 leads, 5 crew ----
    insertUser.run('orga-director', 'orga', 'director', 'Ava Director');
    insertUser.run('orga-lead-1', 'orga', 'lead', 'Liam Lead1');
    insertUser.run('orga-lead-2', 'orga', 'lead', 'Lena Lead2');
    insertUser.run('orga-crew-1', 'orga', 'crew', 'Cora Pilot');
    insertUser.run('orga-crew-2', 'orga', 'crew', 'Cyrus Engineer');
    insertUser.run('orga-crew-3', 'orga', 'crew', 'Cara Pilot2');
    insertUser.run('orga-crew-4', 'orga', 'crew', 'Mira Medic');
    insertUser.run('orga-crew-5', 'orga', 'crew', 'Eli Generalist');

    // ---- OrgB users (minimal, for tenant-isolation test) ----
    insertUser.run('orgb-director', 'orgb', 'director', 'Bob Director');
    insertUser.run('orgb-lead-1', 'orgb', 'lead', 'Blair Lead');
    insertUser.run('orgb-crew-1', 'orgb', 'crew', 'Ben Crew1');
    insertUser.run('orgb-crew-2', 'orgb', 'crew', 'Beth Crew2');

    // ---- Skill catalogs ----
    for (const s of ['piloting', 'eva', 'medical', 'engineering']) {
      insertSkill.run(`orga-skill-${s}`, 'orga', s);
      insertSkill.run(`orgb-skill-${s}`, 'orgb', s);
    }

    // ---- OrgA crew skills (varied levels; only crew-1 meets piloting L3 and is free) ----
    insertCrewSkill.run('orga-crew-1', 'orga-skill-piloting', 4);
    insertCrewSkill.run('orga-crew-1', 'orga-skill-eva', 3);
    insertCrewSkill.run('orga-crew-2', 'orga-skill-piloting', 2); // below L3 -> gap
    insertCrewSkill.run('orga-crew-2', 'orga-skill-engineering', 4);
    insertCrewSkill.run('orga-crew-3', 'orga-skill-piloting', 4); // qualified BUT on leave -> filtered
    insertCrewSkill.run('orga-crew-4', 'orga-skill-medical', 4);
    insertCrewSkill.run('orga-crew-4', 'orga-skill-eva', 3);
    insertCrewSkill.run('orga-crew-5', 'orga-skill-engineering', 3);
    insertCrewSkill.run('orga-crew-5', 'orga-skill-medical', 3);

    // ---- OrgB crew skills ----
    insertCrewSkill.run('orgb-crew-1', 'orgb-skill-piloting', 3);
    insertCrewSkill.run('orgb-crew-2', 'orgb-skill-engineering', 3);

    // ---- OrgA missions ----
    // M0 baseline active mission overlapping M2, used for double-book demo
    insertMission.run(
      'm0-baseline',
      'orga',
      'Baseline station watch',
      'active',
      '2026-12-04',
      '2026-12-08',
      'orga-lead-1',
    );
    // M1 gap demo
    insertMission.run(
      'm1-lunar-survey',
      'orga',
      'Lunar survey',
      'draft',
      '2026-12-01',
      '2026-12-10',
      'orga-lead-1',
    );
    insertReq.run('m1-lunar-survey', 'orga-skill-piloting', 3, 2);
    // M2 overlaps M1
    insertMission.run(
      'm2-orbital-repair',
      'orga',
      'Orbital repair',
      'draft',
      '2026-12-05',
      '2026-12-12',
      'orga-lead-1',
    );
    insertReq.run('m2-orbital-repair', 'orga-skill-engineering', 3, 1);
    // M3 fully coverable, non-overlapping
    insertMission.run(
      'm3-med-evac',
      'orga',
      'Med-evac drill',
      'draft',
      '2027-01-05',
      '2027-01-12',
      'orga-lead-2',
    );
    insertReq.run('m3-med-evac', 'orga-skill-medical', 3, 1);
    insertReq.run('m3-med-evac', 'orga-skill-eva', 2, 1);

    // ---- OrgB mission (tenant leak test target) ----
    insertMission.run(
      'm-orgb-secret',
      'orgb',
      'OrgB secret mission',
      'draft',
      '2026-12-01',
      '2026-12-10',
      'orgb-lead-1',
    );
    insertReq.run('m-orgb-secret', 'orgb-skill-piloting', 3, 1);

    // ---- Availability: crew-3 on leave overlapping M1 ----
    insertBlock.run(
      'blk-crew3-leave',
      'orga-crew-3',
      '2026-12-02',
      '2026-12-06',
      'annual leave',
    );

    // ---- Double-book: crew-2 accepted on M0 (overlaps M2 dates) ----
    insertAsg.run(
      'asg-crew2-baseline',
      'm0-baseline',
      'orga-crew-2',
      'accepted',
      0.9,
      JSON.stringify({ note: 'seed baseline staffing' }),
    );
  });

  seed();

  console.log('Seeded mission-control.db');
  console.log('Orgs: orga, orgb');
  console.log('Try: --as orga-lead-1, --as orga-lead-2, --as orga-director, --as orga-crew-1');
  console.log('Missions: m1-lunar-survey (gap), m2-orbital-repair (overlap), m3-med-evac (coverable)');

  closeDb();
}

run();
