# Mission Control

Multi-tenant B2B platform for space orgs to plan missions and assign crew by
skills, availability, and workload. Working vertical slice: Fastify API +
commander CLI. No web UI. See `DESIGN.md` (pre-implementation design doc).

## Setup

Requires Node 22+.

```bash
npm install
npm run seed   # reset mission-control.db with representative data
npm run api    # Fastify on :3000 (PORT=3100 npm run api for another port)
npm test       # 32 tests (tenancy, SoD, lifecycle, matcher, assignments, roster, CLI)
```

## Seed story

- 2 orgs (`orga`, `orgb`) for tenant-isolation tests.
- OrgA: 1 director, 2 leads, 5 crew; skills `piloting,eva,medical,engineering`.
- `m1-lunar-survey` (12-01..10) needs `piloting L3 x2` — only `orga-crew-1` free
  and qualified (`crew-3` on leave, `crew-2` busy below-level) → gap demo.
- `m2-orbital-repair` (12-05..12) overlaps M1 → double-book filter demo.
- `m3-med-evac` (2027-01) fully coverable.
- `npm run seed` prints usable `--as` ids.

Conventions: readable TEXT ids (`orga-lead-1`) since `x-user-id` is the demo
token; dates are TEXT `YYYY-MM-DD` inclusive UTC days (lexicographic compare
== chronological). No time-of-day by design.

## CLI

```bash
# discovery (all calls need --as; add --json for piping, --api for non-default port)
npm run cli -- --as orga-lead-1 users
npm run cli -- --as orga-lead-1 missions list
npm run cli -- --as orga-lead-1 skills list

# plan → match → propose → approve (SoD demo — happy path, no removes)
npm run cli -- --as orga-lead-1 missions create --title "Relay fix" --start 2027-02-01 --end 2027-02-05
npm run cli -- --as orga-lead-1 requirements add <mission-id> --skill piloting --min-level 3 --count 1
npm run cli -- --as orga-lead-1 match <mission-id>
npm run cli -- --as orga-lead-1 assignments propose <mission-id> orga-crew-1
npm run cli -- --as orga-lead-1 assignments list --mission <mission-id>
npm run cli -- --as orga-crew-1 assignments list --mine
npm run cli -- --as orga-lead-1 missions submit <mission-id>
npm run cli -- --as orga-lead-1 missions approve <mission-id>  # fails: [SELF_APPROVAL]
npm run cli -- --as orga-lead-2 missions approve <mission-id>  # succeeds (peer)
npm run cli -- --as orga-crew-1 assignments respond <assignment-id> --accept

# iterate (only in draft|proposed — locked after approval)
npm run cli -- --as orga-lead-1 missions edit <mission-id> --title "Relay fix v2"
npm run cli -- --as orga-lead-1 requirements remove <mission-id> --skill piloting

# roster / availability
npm run cli -- --as orga-director skills add medical
npm run cli -- --as orga-crew-1 availability add --start 2026-12-20 --end 2026-12-22 --reason rest
npm run cli -- --as orga-crew-1 availability list
```

### All commands

Global flags (every call): `--as <user-id>` (required), `--json`, `--api <url>` (default `http://localhost:3000`).

```bash
# users / discovery
npm run cli -- --as <id> users

# missions
npm run cli -- --as <id> missions list
npm run cli -- --as <id> missions show <mission-id>
npm run cli -- --as <id> missions create --title <t> --start <YYYY-MM-DD> --end <YYYY-MM-DD>
npm run cli -- --as <id> missions edit <mission-id> [--title <t>] [--start <YYYY-MM-DD>] [--end <YYYY-MM-DD>]
npm run cli -- --as <id> missions submit|approve|reject|activate|complete|cancel <mission-id>

# requirements (upsert by skill, draft|proposed only)
npm run cli -- --as <id> requirements add <mission-id> --skill <name> --min-level <n> --count <n>
npm run cli -- --as <id> requirements remove <mission-id> --skill <name>

# matching
npm run cli -- --as <id> match <mission-id>

# assignments
npm run cli -- --as <id> assignments list [--mission <mission-id>] [--mine]
npm run cli -- --as <id> assignments propose <mission-id> <user-id>
npm run cli -- --as <id> assignments respond <assignment-id> --accept|--decline

# crew (staffing list is users filtered by role)
npm run cli -- --as <id> crew list                  # → GET /users?role=crew
npm run cli -- --as <id> crew profile <user-id>
npm run cli -- --as <id> crew skills <user-id> --skill <skill-id> --level <1-5>

# skills
npm run cli -- --as <id> skills list
npm run cli -- --as <id> skills add <name>              # director only

# availability
npm run cli -- --as <id> availability list
npm run cli -- --as <id> availability add --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--reason <r>]
npm run cli -- --as <id> availability remove <block-id>
```

Human tables by default; errors print as `[CODE] message`
(`[SELF_APPROVAL]`, `[INVALID_TRANSITION]`, `[NOT_FOUND]`).

## API (all require `x-user-id`)

| Method | Path | Role |
|---|---|---|
| GET | `/users[?role=crew\|lead\|director]`, `/missions`, `/missions/:id` (+`requirements[]`) | any (org-scoped, cross-org → 404) |
| POST / PATCH | `/missions` / `/missions/:id` (title/dates) | lead+, edit in draft\|proposed only |
| POST | `/missions/:id/submit\|approve\|reject\|activate\|complete\|cancel` | lead+, SoD on approve/reject |
| GET | `/missions/:id/matches` | lead+, draft\|proposed only |
| POST / DELETE | `/missions/:id/requirements` (`:skill`) | lead+, draft\|proposed only (upsert/delete) |
| GET / POST | `/assignments[?mission_id][?mine]` / `/assignments` | crew own, lead+ org-wide; propose draft\|proposed only |
| POST | `/assignments/:id/respond` | assignee or director |
| GET | `/skills` | any (open catalog — see below) |
| POST | `/skills` | director |
| GET | `/users/:id`, `PATCH /users/:id/skills` | scoped; skills own-or-director |
| GET/POST/DELETE | `/availability` | own; lead/director view, director delete override |

Errors: `{error:{code,message}}`. 401 anon, 403 role/SoD, 404 scoped (no org
probe), 409 bad transition/duplicate.

## Notes / deviations

- `GET /skills` is open to all org members (DESIGN said director). Leads need
  it for requirements; crew seeing peer skills is low-risk (no PII).
- OrgB seed is minimal (1 lead, 2 crew) vs spec 2+5 — sufficient for the 404
  isolation test.
- Matcher tests isolate `m0-base` to 12-11..12 (M2-only overlap) so M1 shows
  ranking+gaps; seed keeps 12-04..08 (overlaps both) per spec "only 1 qualified".
- DB: `better-sqlite3`, no ORM (guardrail). Shared reads in
  `src/db/queries.ts`; domain SQL stays with its service. Casts in queries,
  zod at API boundaries, role validated at the auth gate.

## Layout

`src/server.ts` `src/db/{schema.sql,client.ts,queries.ts,ids.ts,seed.ts}`
`src/services/{auth,mission,matcher,assignments,roster}.ts`
`src/schemas.ts` `cli/{index.ts,client.ts}` `tests/*.test.ts` (+`helpers.ts`)
