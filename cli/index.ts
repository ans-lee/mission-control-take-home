import { Command } from 'commander';
import { api, print, type CliOpts } from './client.js';

const program = new Command();
program
  .name('mc')
  .description('Mission Control CLI (thin client over the API)')
  .option('--as <user-id>', 'actor id (seeded ids, e.g. orga-lead-1)')
  .option('--api <url>', 'api base url', process.env.MC_API ?? 'http://localhost:3000')
  .option('--json', 'raw JSON output');

function opts(): CliOpts {
  const o = program.opts();
  return { as: o.as, api: o.api, json: o.json };
}

async function run(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    console.error(e.message ?? e);
    process.exit(1);
  }
}

// ---- users ----
program
  .command('users')
  .description('list users in your org (to discover --as ids)')
  .action(() => run(async () => print(opts(), await api(opts(), 'GET', '/users'))));

// ---- missions ----
const missions = program.command('missions').description('plan missions');
missions
  .command('list')
  .action(() => run(async () => print(opts(), await api(opts(), 'GET', '/missions'))));
missions
  .command('create')
  .requiredOption('--title <t>')
  .requiredOption('--start <YYYY-MM-DD>')
  .requiredOption('--end <YYYY-MM-DD>')
  .action((c) =>
    run(async () =>
      print(
        opts(),
        await api(opts(), 'POST', '/missions', {
          title: c.title,
          start_date: c.start,
          end_date: c.end,
        }),
      ),
    ),
  );
missions
  .command('show <id>')
  .action((id) => run(async () => print(opts(), await api(opts(), 'GET', `/missions/${id}`))));
missions
  .command('edit <id>')
  .option('--title <t>')
  .option('--start <YYYY-MM-DD>')
  .option('--end <YYYY-MM-DD>')
  .action((id, c) =>
    run(async () => {
      const body: any = {};
      if (c.title) body.title = c.title;
      if (c.start) body.start_date = c.start;
      if (c.end) body.end_date = c.end;
      if (Object.keys(body).length === 0) {
        console.error('pass at least one of --title | --start | --end');
        process.exit(1);
      }
      return print(opts(), await api(opts(), 'PATCH', `/missions/${id}`, body));
    }),
  );
for (const a of ['submit', 'approve', 'reject', 'activate', 'complete', 'cancel'] as const) {
  missions
    .command(`${a} <id>`)
    .action((id) => run(async () => print(opts(), await api(opts(), 'POST', `/missions/${id}/${a}`))));
}

// ---- requirements (upsert by skill, editable in draft|proposed only) ----
const reqs = program.command('requirements').description('mission requirements');
reqs
  .command('add <mission-id>')
  .requiredOption('--skill <name>')
  .requiredOption('--min-level <n>', '', '3')
  .requiredOption('--count <n>', '', '1')
  .action((mid, c) =>
    run(async () =>
      print(
        opts(),
        await api(opts(), 'POST', `/missions/${mid}/requirements`, {
          skill: c.skill,
          min_level: Number(c.minLevel),
          min_count: Number(c.count),
        }),
      ),
    ),
  );
reqs
  .command('remove <mission-id>')
  .requiredOption('--skill <name>')
  .action((mid, c) =>
    run(async () => print(opts(), await api(opts(), 'DELETE', `/missions/${mid}/requirements/${c.skill}`))),
  );

// ---- match ----
program
  .command('match <mission-id>')
  .description('ranked crew matches with reasons')
  .action((mid) => run(async () => print(opts(), await api(opts(), 'GET', `/missions/${mid}/matches`))));

// ---- assignments ----
const asg = program.command('assignments').description('staff missions');
asg
  .command('list')
  .option('--mission <id>')
  .option('--mine', 'only mine')
  .action((c) => {
    const q = new URLSearchParams();
    if (c.mission) q.set('mission_id', c.mission);
    if (c.mine) q.set('mine', '1');
    const suffix = q.size ? `?${q}` : '';
    return run(async () => print(opts(), await api(opts(), 'GET', `/assignments${suffix}`)));
  });
asg
  .command('propose <mission-id> <user-id>')
  .action((mid, uid) =>
    run(async () => print(opts(), await api(opts(), 'POST', '/assignments', { mission_id: mid, user_id: uid }))),
  );
asg
  .command('respond <assignment-id>')
  .option('--accept', 'accept')
  .option('--decline', 'decline')
  .action((aid, c) => {
    if (!!c.accept === !!c.decline) {
      console.error('pass exactly one of --accept | --decline');
      process.exit(1);
    }
    return run(async () =>
      print(opts(), await api(opts(), 'POST', `/assignments/${aid}/respond`, { accept: !!c.accept })));
  });

// ---- crew / skills (staffing list is users filtered by role) ----
const crew = program.command('crew').description('crew profiles');
crew.command('list').action(() => run(async () => print(opts(), await api(opts(), 'GET', '/users?role=crew'))));
crew
  .command('profile <user-id>')
  .action((uid) => run(async () => print(opts(), await api(opts(), 'GET', `/users/${uid}`))));
crew
  .command('skills <user-id>')
  .requiredOption('--skill <skill-id>')
  .requiredOption('--level <n>')
  .action((uid, c) =>
    run(async () =>
      print(
        opts(),
        await api(opts(), 'PATCH', `/users/${uid}/skills`, {
          skills: [{ skill_id: c.skill, level: Number(c.level) }],
        }),
      ),
    ),
  );

const skills = program.command('skills').description('skill catalog');
skills.command('list').action(() => run(async () => print(opts(), await api(opts(), 'GET', '/skills'))));
skills
  .command('add <name>')
  .action((name) => run(async () => print(opts(), await api(opts(), 'POST', '/skills', { name }))));

// ---- availability ----
const avail = program.command('availability').description('leave blocks');
avail.command('list').action(() => run(async () => print(opts(), await api(opts(), 'GET', '/availability'))));
avail
  .command('add')
  .requiredOption('--start <YYYY-MM-DD>')
  .requiredOption('--end <YYYY-MM-DD>')
  .option('--reason <r>')
  .action((c) =>
    run(async () =>
      print(
        opts(),
        await api(opts(), 'POST', '/availability', {
          start_date: c.start,
          end_date: c.end,
          reason: c.reason,
        }),
      ),
    ),
  );
avail
  .command('remove <id>')
  .action((id) => run(async () => print(opts(), await api(opts(), 'DELETE', `/availability/${id}`))));

program.parseAsync(process.argv);
