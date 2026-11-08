# Take-home brief analysis

> All user and assistant text is verbatim.

## Contents

1. [Turn 1](#turn-1) — I'm working on a take home assessment. Read through @take-home-brief.md carefully. I want to work th
2. [Turn 2](#turn-2) — Let me discuss the scope first. As shown in the brief, I will need to extend this during the intervi
3. [Turn 3](#turn-3) — Let's start discussing the stack and data model for the design document. As mentioned, we can keep i
4. [Turn 4](#turn-4) — Do we need a framework like Fastify or Express? I know it says API is required but does it make sens
5. [Turn 5](#turn-5) — No as in, do we need to do this via HTTP? Is it better to go with a pure CLI setup only?
6. [Turn 6](#turn-6) — Just making sure we aren't overcomplicating our solution, it makes sense as I double checked the bri
7. [Turn 7](#turn-7) — What is commander for CLI?
8. [Turn 8](#turn-8) — Sounds good, let's go with that. What's next?
9. [Turn 9](#turn-9) — Did we go over the data model sketch?
10. [Turn 10](#turn-10) — From the brief it isn't clear how the mission requirements should be built. Personally I think going
11. [Turn 11](#turn-11) — Does the brief say we need availability blocks besides the missions or is that something we believe 
12. [Turn 12](#turn-12) — Hmm this is bordering feature creeping. This seems like something that could be left to extending it
13. [Turn 13](#turn-13) — Ok I think we're good for the data model. What's next/
14. [Turn 14](#turn-14) — What do you mean by SoD? Also by System do you mean the API? The roles say that mission leads cannot
15. [Turn 15](#turn-15) — Why does the brief say that Mission Leads should not be able to approve their own missions?
16. [Turn 16](#turn-16) — Does it say Directors can make their own missions?
17. [Turn 17](#turn-17) — This is really important, let's think it through. This is testing my product decision moreso than th
18. [Turn 18](#turn-18) — Is there a situation where "going up" in the role e.g. from mission lead to director should lose som
19. [Turn 19](#turn-19) — Yeah that makes sense, but for lead to director we shouldn't expect some permissions to be lost?
20. [Turn 20](#turn-20) — ok what does the new lifecycle look like?
21. [Turn 21](#turn-21) — Do you expect any issues with director inheriting lead's permissions so far?
22. [Turn 22](#turn-22) — Sounds good, we can always change this later during the implementation. Let's move on to matcher sco
23. [Turn 23](#turn-23) — What are the tradeoffs of introducing this scoring system? So far it I think it makes sense, the ski
24. [Turn 24](#turn-24) — I agree. Let's remove the slack for now. Right now it's not clear how well the matcher scoring will 
25. [Turn 25](#turn-25) — Ok let's continue
26. [Turn 26](#turn-26) — What's the patch endpoint /users/:id/skills for? Also why x-org-id and x-user-id instead of passing 
27. [Turn 27](#turn-27) — Yeah that makes sense. Let's talk about x-user-id in more detail. Like you said it's used to stub fo
28. [Turn 28](#turn-28) — Ok gotcha, so both x-org-id and x-user-id are stubs for token as we don't want to implement real aut
29. [Turn 29](#turn-29) — Right now I feel like it is confusing to use x-user-id as the user's auth token but we would be intr
30. [Turn 30](#turn-30) — Right now the brief doesn't state that a user would be in multiple orgs right? So going with the ass
31. [Turn 31](#turn-31) — Ok sounds good. Let's go with this API setup. What's next?
32. [Turn 32](#turn-32) — Yes this sounds perfect. Let's start creating the design doc
33. [Turn 33](#turn-33) — Be specific about what SoD is. Also does it make sense to create mermaid diagrams for the data model
34. [Turn 34](#turn-34) — The newlines aren't rendering properly in the mermaid diagram
35. [Turn 35](#turn-35) — Is there anything else we are missing from the @take-home-brief.md ? I think we're pretty solid here
36. [Turn 36](#turn-36) — Yes please!
37. [Turn 37](#turn-37) — What is §? Could we not use that symbol as it's confusing?
38. [Turn 38](#turn-38) — Ok how does the design doc look? The @take-home-brief.md brief mentions this is quite important and 
39. [Turn 39](#turn-39) — Ok let's clean that up first
40. [Turn 40](#turn-40) — Just wanted to clarify, how would we use the CLI? Show me an example

---

<a id="turn-1"></a>
## Turn 1

**You**

I'm working on a take home assessment. Read through @take-home-brief.md carefully. I want to work through the requirements and design the solution before we start writing code.

Can you analyse the brief and tell me the following:
1. What we're being asked to build
2. The requirements
3. Any ambiguities or assumptions we need to address
4. What do you think the most important engineering challenges are

Let's work through this together, don't modify any files yet. Keep your responses concise and practical, focus on the important details and avoid lengthy explanations unless I ask for more detail

> 📎 `take-home-brief.md` — content in JSON export

**Assistant**

Breaking down the brief into build scope, requirements, and key tradeoffs.

## 1. What we're being asked to build

**Mission Control core, vertical slice:** Multi-tenant B2B platform for orgs to plan missions and assign crew.

Deliverables (all equally graded):
1. **Design doc first** - your technical direction for a team + AI agent. No prescribed format.
2. **Working API + CLI** - runs locally, with seed data + setup instructions. No web UI needed.
3. **Source code** - GitHub repo with meaningful history (not one big commit).
4. **Full unedited AI transcripts** - including this conversation if you use it for brainstorming.

The meta-test: your framing, decisions, and trade-offs must clearly come from *you*. Blindly accepting agent suggestions = fail, even if code works.

## 2. Requirements

**Explicit minimum scope:**
- Multi-tenant API: all data strictly scoped to org, no cross-tenant leakage
- 3 roles: `Director` (settings, approve, broad visibility), `Mission Lead` (create/plan, run matcher, submit, cannot self-approve), `Crew` (own profile/availability, respond to assignments, limited visibility)
- Mission lifecycle + approval workflow: you design states/transitions
- Crew management: skill profiles, availability, assignment history - you design skill/proficiency model
- Auto-matching engine: suggest crew by skills + availability + constraints/workload
- CLI covering primary workflows, with good UX (explicitly assessed)

**Implicit (from "senior-level judgment"):**
- Coherent data model, intentional API/CLI design, team-ready code structure
- Verification evidence over polish (3-5hr budget)
- You choose stack - they use TS/React/Python/GCP, but effectiveness > alignment

## 3. Ambiguities / Assumptions to lock down

These are intentional - how you resolve them is graded. We need to pick a stance for each:

1. **Identity/tenancy:** How is org+role established per request? Simplest: seeded users + `X-Org-ID` / `X-User-ID` headers or CLI `--as` flag. No real OAuth - out of scope for 3-5hrs.
2. **Skill model:** Free-text vs org-defined taxonomy? Proficiency levels (1-5 vs beginner/expert)? Assume: per-org skill catalog + 1-5 proficiency + required vs nice-to-have on missions.
3. **Availability model:** Calendar blocks vs status flag vs date ranges? Need to decide: unavailability windows + mission date overlap detection is minimum viable.
4. **Mission lifecycle:** Propose: `draft -> proposed (submitted) -> approved/active -> completed/cancelled`, with `rejected` loop. Who can transition what?
5. **Assignment lifecycle:** Is matching just a suggestion, or does it create assignments? Do crew accept/decline? Assume: matcher returns ranked suggestions → lead creates `proposed` assignments → crew `accept/decline` → confirmed.
6. **Workload constraint:** Max concurrent missions? Hours? Assume: no overlapping active assignments + soft-penalty for recent mission count.
7. **Approval SoD:** "Cannot approve own missions" = need `submitted_by != approver` check. What if director creates mission?
8. **Persistence:** SQLite/Postgres vs in-memory? For demo + review speed, SQLite file + seed script wins.

## 4. Key engineering challenges (where seniority shows)

1. **Tenant + RBAC enforcement that can't be bypassed:** Per-request scoping middleware + role checks + SoD rule. Easy to demo-leak here; needs tests proving isolation.
2. **Matcher with real thought:** Not just skill filter. Needs to combine hard constraints (tenant, availability overlap, min proficiency) + soft scoring (skill match %, workload balance, explainability). Must return *why* someone was ranked.
3. **Lifecycle as state machine, not if-statements:** Invalid transitions (e.g. `draft -> active`, lead self-approval) must be rejected centrally. This is what they'll probe in the live deep-dive.
4. **CLI as the product surface:** Since no UI, CLI has to make `create mission → run match → assign → submit → approve` feel like one coherent flow with role-switching.
5. **Scope control for 3-5hrs:** Vertical slice that runs end-to-end beats broad-but-broken. Design doc must explicitly mark non-goals (real auth, calendar integration, notifications).

---
Next step suggestion: lock down 1) stack, 2) data model sketch, 3) lifecycle states, 4) matcher scoring approach. Want to start with stack + data model?

<details><summary>Tools: read×1</summary>

- `read`

</details>

---

<a id="turn-2"></a>
## Turn 2

**You**

Let me discuss the scope first. As shown in the brief, I will need to extend this during the interview. This means we should follow the minimum requirements closely right? Unless there is some polish we can do that isn't a large change

**Assistant**

Yes. Stick to minimum + make it extensible. They tell you the live extensions upfront: resource constraints, approval workflow redesign.

That means they grade seams, not features. Overbuilding now wastes your 3-5hrs and makes live changes harder.

**Build exactly this:**
- Tenancy scoping, 3 roles + SoD check, mission lifecycle, crew/skills/availability, matcher, assignments, CLI for `create -> match -> assign -> submit -> approve`

**Cheap polish worth doing:**
- Matcher returns explanations (`score: 0.82, reasons: [...]`), not just list - shows thought, enables future weights
- Lifecycle as explicit transition table, not scattered `if`s - lets you redesign workflow live in minutes
- Tenant/role checks in one middleware layer with tests - proves no leakage
- Good CLI UX: `login --as`, human + `--json` output, clear errors, seed data that demos a conflict (overlap, skill gap)

**Explicitly don't build:**
Real auth/JWT, per-org custom skill taxonomies UI, calendar integration, notifications, web UI, equipment/resources as first-class - just leave a hook for them.

In the design doc, label a `Non-goals / Future extension points` section: where resources would plug into matcher, how approval chain would become pluggable. That's what they'll ask you to extend.

---

<a id="turn-3"></a>
## Turn 3

**You**

Let's start discussing the stack and data model for the design document. As mentioned, we can keep it simple. Let's use TypeScript. For storage, we can go with SQLite or even just regular files. Discuss with me about this approach and what else we need to account for

**Assistant**

TS + SQLite is the right default. Aligns with their stack, zero infra, easy to run.

**API:** Node + TypeScript + Fastify (or Express if you know it better). Add `zod` for validation - cheap and prevents bad data from reaching matcher. No ORM - `better-sqlite3` + plain SQL migrations file. Keeps data model visible for review.

**CLI:** Same repo, `commander` + direct HTTP calls to API. Share zod schemas for types. Support ` --as <user-id>` + `--json` for scripting.

**SQLite vs files:**
- Files (JSON): zero deps, but you hand-roll locking, overlap queries, tenant filtering. Breaks as soon as matcher needs `where date overlaps`.
- SQLite: single file, no Docker, transactions + indexed queries (`org_id`, date ranges) for free. `seed.sql` + `reset` command is trivial.

Go SQLite. One `schema.sql`, one `seed.ts`.

**Data model sketch to lock down:**

- `organisations(id, name)`
- `users(id, org_id, role: director|lead|crew, name)` - auth stub
- `skills(id, org_id, name)` - per-org catalog
- `crew_skills(user_id, skill_id, level 1-5)`
- `missions(id, org_id, title, status, start_date, end_date, created_by)`
- `mission_requirements(mission_id, skill_id, min_level, min_count)`
- `assignments(id, mission_id, user_id, status: proposed|accepted|declined|confirmed, score, reasons)`
- `availability_blocks(user_id, start_date, end_date, type: unavailable)` - mission overlap = conflict

Open questions for you:
1. `min_count` per skill - do we need "2x piloting L3" or just "needs piloting"?
2. Availability - blocked ranges enough, or need recurring/partial?
3. Assignments - does lead confirm directly, or crew must accept first?

My take: keep all three simple - `min_count`, blocked ranges only, `proposed -> accepted/declined`.

---

<a id="turn-4"></a>
## Turn 4

**You**

Do we need a framework like Fastify or Express? I know it says API is required but does it make sense to use those frameworks? We need to get a CLI running to run the API but is this the correct choice? Why or why not?

**Assistant**

Yes, use one. Don't hand-roll HTTP.

Brief requires a **multi-tenant API** - that means a network boundary other systems (and your CLI) call with tenant + user context. If CLI just imports functions directly, you have no API to review, no isolation boundary to test, and it doesn't look like a B2B platform.

Raw `node:http` saves one dependency but costs you routing, JSON parsing, error mapping, middleware for `org/role` checks. That's boilerplate reviewers read as junior. Fastify/Express gives you that in ~20 lines and looks like team code.

Recommendation:

- API process: `npm run api` (Fastify, prefer over Express - built-in validation + TS types, same effort)
- CLI process: `npm run cli -- <command>` - thin HTTP client, not in-process calls. Keeps the tenant/RBAC boundary real and testable via `curl`.
- Shared: `zod` schemas + types imported by both, so CLI/API can't drift.

Only case to skip framework is if you make CLI test-only and claim functions *are* the API - that will read as missing the requirement.

---

<a id="turn-5"></a>
## Turn 5

**You**

No as in, do we need to do this via HTTP? Is it better to go with a pure CLI setup only?

**Assistant**

No - pure CLI fails the brief.

It explicitly requires both: a multi-tenant API *and* a CLI to exercise it. CLI-only has no network boundary, so you can't demonstrate tenant isolation or server-side role checks - two things they're grading.

HTTP cost is minimal (~1 Fastify file + `fetch` in CLI) and it pays off:

- Proves isolation: `curl` as org-A can't see org-B
- Matches B2B story: other systems integrate via API, humans via CLI
- Live extension is easier: they can ask for a new endpoint + CLI command

Pattern: API owns all logic + SQLite. CLI is dumb - just sends `X-Org/User` headers and prints results.

---

<a id="turn-6"></a>
## Turn 6

**You**

Just making sure we aren't overcomplicating our solution, it makes sense as I double checked the brief mentions an API and CLI. In that case, for simplicity would you say Fastify is a better choice? We want extensibility ease, and something that is simple and easy to learn. Also for SQLite, is better-sqlite3 the standard?

**Assistant**

Yes, Fastify for your goals.

- **Fastify vs Express:** Express is more familiar to most reviewers, but Fastify wins on simplicity + extensibility: built-in JSON validation, async handlers without `next()`, TS types out of box, plugin system for adding auth/tenant hooks later. Learning curve is ~30 mins if you know Express.
- **better-sqlite3:** Yes, the default for this shape. Sync, zero-config, single file, fast enough for seed + matcher queries. Alternative is Node 22+ built-in `node:sqlite` - viable to avoid a native dep, but docs/examples are thinner. Stick with `better-sqlite3` + plain SQL in `schema.sql`. Skip Drizzle/Prisma - ORM hides the data model they're grading and adds setup time.

---

<a id="turn-7"></a>
## Turn 7

**You**

What is commander for CLI?

**Assistant**

`commander` is the standard Node CLI parser. Turns `process.argv` into structured commands.

Without it you hand-roll `if (args[2] === '...')`. With it:

`cli missions create --title "Europa" --as lead-1` gets parsing, `--help`, required flags, and subcommands (`missions`, `crew`, `match`) for free.

Use it - it's 10 lines to get `cli <resource> <action> [options]` + auto help, which is most of the CLI UX they're grading. Alternatives (`yargs`, `citty`) do the same; `commander` has the most examples.

---

<a id="turn-8"></a>
## Turn 8

**You**

Sounds good, let's go with that. What's next?

**Assistant**

Next, lock the 3 decisions that drive the design doc:

1. **Lifecycle + roles matrix** - states (`draft → proposed → approved/active → completed`, + `rejected/cancelled`) and who can fire each transition + SoD rule
2. **Matcher scoring** - hard filters vs soft score, weights, explanation output
3. **API + CLI surface** - ~10 endpoints and matching CLI commands for the `create → match → assign → submit → approve` flow

Want to do lifecycle first? It's the smallest and unblocks the data model.

---

<a id="turn-9"></a>
## Turn 9

**You**

Did we go over the data model sketch?

**Assistant**

Yes, draft from earlier - let's finalize it:

- `organisations(id, name)`
- `users(id, org_id, role, name)` - `director|lead|crew`
- `skills(id, org_id, name)`
- `crew_skills(user_id, skill_id, level 1-5)`
- `missions(id, org_id, title, status, start/end_date, created_by)`
- `mission_requirements(mission_id, skill_id, min_level, min_count)`
- `assignments(id, mission_id, user_id, status, score, reasons)`
- `availability_blocks(user_id, start/end_date)` - overlap = conflict

Still open:
1. Need `min_count` (e.g. 2x piloting L3) or single requirement per skill?
2. Availability as blocked ranges only - enough?
3. Assignment flow: `proposed → accepted/declined` with lead confirming?

Call these and the model is locked for the doc.

---

<a id="turn-10"></a>
## Turn 10

**You**

From the brief it isn't clear how the mission requirements should be built. Personally I think going simple with what we have is best e.g. if min_count is 2 and min level is 3, we need 2 users with min level 3 for the skill to complete the mission.

availability blocks are tied to missions right? Does it make sense to derive it from there? It might get confusing if we have information from two sources.

For no.3 proposed -> accepted/declined is fine. We can add a new state like in review if needed based on requirements later but it looks like it's fine.

**Assistant**

Agreed on all three.

1. **Requirements:** `skill_id + min_level + min_count` with your semantics - e.g. `piloting L3 x2` means 2 distinct crew >=L3. Simple, testable, matcher can report `covered 1/2`.

2. **Availability - use both, but don't store twice:**
   - Stored: `availability_blocks` = explicit time off (leave, training)
   - Derived: overlapping `accepted/confirmed` assignments = busy
   - Matcher checks both at runtime. If you only use explicit blocks, you'll double-book crew. If you only derive from missions, crew can't mark leave. Keep both, compute conflict on read.

3. **Assignments:** `proposed → accepted / declined`. Lead creates `proposed`, crew responds. No extra states now - add `confirmed` later if leads need final sign-off.

This locks the model. Next: lifecycle transitions or matcher scoring?

---

<a id="turn-11"></a>
## Turn 11

**You**

Does the brief say we need availability blocks besides the missions or is that something we believe we need to add on our own?

**Assistant**

Brief only says crew have "availability" + "assignment history" - no shape prescribed.

Strict reading: availability could be just derived from overlapping missions. But then it's redundant with history and crew can't mark leave/training - matcher would be skills-only + double-booking check.

`availability_blocks` is our addition to make availability real. Document it as an assumption in the design doc: explicit off-windows + derived busy from assignments. Minimal cost, makes matcher credible.

---

<a id="turn-12"></a>
## Turn 12

**You**

Hmm this is bordering feature creeping. This seems like something that could be left to extending it in the interview

**Assistant**

Fair call - cut it for MVP.

Minimal reading that still passes: availability = not already assigned to an overlapping mission. That uses `missions.start/end + assignments` you already have, no extra table.

Trade-off: crew then has no leave to manage, just profile + respond to assignments. Document that as a deliberate simplification with extension hook: `availability_blocks` plugs into the matcher's `is_available()` check later - perfect live-extension story.

Lock it: no `availability_blocks` table in v1.

---

<a id="turn-13"></a>
## Turn 13

**You**

Ok I think we're good for the data model. What's next/

**Assistant**

Next: mission lifecycle + roles matrix. It defines your state machine and SoD rule.

Proposal to react to:

States: `draft → proposed → approved → active → completed`, plus `rejected` (→ draft) and `cancelled` (from approved/active).

Transitions:
- Lead: `create(draft)`, `submit: draft/rejected → proposed`, `cancel`
- Director: `approve: proposed → approved` (reject → `rejected`), must enforce `submitted_by != approver`
- System/Lead: `approved → active` on start_date, `active → completed`

Assignments only creatable in `draft/proposed`, locked after `approved`.

Does that match your mental model, or want `approved` and `active` merged?

---

<a id="turn-14"></a>
## Turn 14

**You**

What do you mean by SoD? Also by System do you mean the API? The roles say that mission leads cannot approve their own missions but they're allowed to approve other's missions right? Just making sure

**Assistant**

SoD = Separation of Duties - `submitter != approver`. Just shorthand for that rule.

By System I meant auto-transition (API flips `approved → active` on `start_date`) vs manual endpoint where lead/director triggers it. Recommend manual `activate` endpoint for MVP - no cron/job to build.

On approval: ambiguous in brief. Two readings:
1. **Director-only:** only directors approve. "Can't approve own" is then automatic.
2. **Peer approval:** leads can approve others' missions, just not their own.

Go with 1 for MVP - simplest, matches "Directors... approve missions / Leads... submit for approval". Document 2 as future option. It also gives you a clean interview extension (add peer-approval chain).

---

<a id="turn-15"></a>
## Turn 15

**You**

Why does the brief say that Mission Leads should not be able to approve their own missions?

**Assistant**

Governance - prevents someone marking their own planning as reviewed. Same reason expense reports need a second signer.

It matters even with director-only approval: a director could create a mission then approve it themselves. The rule generalizes to `approver != submitter` for everyone, not just leads. That's what we'll enforce + test.

---

<a id="turn-16"></a>
## Turn 16

**You**

Does it say Directors can make their own missions?

**Assistant**

No - it doesn't. It says leads plan/manage, directors approve + settings.

Assumption to lock: allow both to create/submit, director-only approve, SoD applies to everyone. Keeps roles crisp (leads own planning, directors own approval) while letting a director act as lead in small orgs. If we restricted creation to leads-only, we'd need a workaround for that case anyway.

---

<a id="turn-17"></a>
## Turn 17

**You**

This is really important, let's think it through. This is testing my product decision moreso than the engineering which is still crucial in this assessment based on the brief.

To keep thing simple, even if we have to make assumptions, let's decide on how it should work and what makes sense.

The brief says Mission Leads "should not approve their own missions", so let's make it so that they can approve missions but not their own. Directors are also mentioned that they have broad visibility and it looks like they should be able to do what mission leads can do. So they should have all the permissions a mission lead has.

Also, I just noticed it says Crew Members can manage their availability so I guess it makes sense they can schedule availability blocks.

**Assistant**

Good catch - let's lock it as you said, it's cleaner product-wise:

**Permission model: hierarchical + SoD for all**

- Crew: own profile/skills, own availability blocks, view own assignments, accept/decline
- Lead: all crew-self powers (for their own user) + create/edit missions, manage requirements, run matcher, create assignments, submit `draft → proposed`, approve `proposed → approved` for missions they **didn't** submit
- Director: all lead powers + org settings/skills catalog + approve any mission they didn't submit + full org visibility

Why this works:
- Explains "leads can't approve own" literally, not as redundant text
- Director = lead superset, no special-case code - just role hierarchy + one SoD check
- Small orgs don't block when director is away (peer lead can approve)
- SoD universal: `approver != submitter`, regardless of role

**Crew availability:** yes, bring back minimal `availability_blocks(user_id, start/end_date)`. Crew manages own only. Matcher treats as hard filter, same as overlapping assignments. ~1 table + 2 endpoints, and without it crew has almost nothing to do.

This is your documented assumption - state it explicitly in the design doc.

---

<a id="turn-18"></a>
## Turn 18

**You**

Is there a situation where "going up" in the role e.g. from mission lead to director should lose some permissions? There are many different ways RBAC is handled but it for this case hierachical makes the most sense?

**Assistant**

No - for this brief, up should only gain. Losing permissions going up (e.g. manager can't do IC work) fits strict enterprise SoD, but adds friction here and contradicts "broad visibility."

Hierarchical fits because:
- Small orgs: director *is* a lead sometimes
- Implementation is one rank check (`director >= lead >= crew`) + SoD + owner-check, easy to extend to per-permission RBAC later
- Alternative (director = approver-only, can't plan) would block demos and need delegation logic - overkill for 3-5hrs

Document as: roles are cumulative. If you need strict separation later, split into discrete permissions without changing endpoints.

---

<a id="turn-19"></a>
## Turn 19

**You**

Yeah that makes sense, but for lead to director we shouldn't expect some permissions to be lost?

**Assistant**

Correct - no loss. Director = lead powers + settings + full visibility. Only restriction carrying up is SoD (can't approve own, regardless of role).

---

<a id="turn-20"></a>
## Turn 20

**You**

ok what does the new lifecycle look like?

**Assistant**

Updated with peer approval + SoD for all:

**States:** `draft → proposed → approved → active → completed`
Side: `proposed → rejected → draft` (resubmit loop), `approved/active → cancelled`

**Transitions:**
- `create → draft`: lead, director
- `submit: draft/rejected → proposed`: lead, director (sets `submitted_by`)
- `approve: proposed → approved`: lead, director, if `actor != submitted_by`
- `reject: proposed → rejected`: lead, director, if `actor != submitted_by`
- `activate: approved → active`: lead, director (manual endpoint, no cron)
- `complete: active → completed`: lead, director
- `cancel`: lead, director (from `approved/active`)

**Rules:**
- Assignments + matcher only in `draft/proposed`. Locked after `approved`.
- Crew accept/decline allowed while mission is `proposed/approved/active`.

Want to lock this and move to matcher scoring?

---

<a id="turn-21"></a>
## Turn 21

**You**

Do you expect any issues with director inheriting lead's permissions so far?

**Assistant**

One edge, already solved by your peer-approval call:

Single-director org where director submits - with director-only approval it deadlocks. With lead-peer approval, any other lead can approve, so no deadlock.

Otherwise clean:
- SoD still holds (`approver != submitter` for all)
- Audit needs `submitted_by / approved_by` stored - trivial
- Director editing any mission is intended ("broad visibility"), not a bug for MVP

---

<a id="turn-22"></a>
## Turn 22

**You**

Sounds good, we can always change this later during the implementation. Let's move on to matcher scoring

**Assistant**

Proposal - two-stage, explainable, no ML:

**Hard filters (exclude):**
- Wrong org, mission not `draft/proposed`
- Date overlap with accepted assignment or `availability_blocks`
- Zero overlapping required skills (avoids noise)

**Soft score 0-1 per crew:**
- `skill 0.6`: for each requirement, `min(crew_level / min_level, 1.2 capped)` averaged, weighted by `min_count` coverage. Missing skill = 0 for that req.
- `workload 0.25`: `1 / (1 + active_assignments)` - prefers rested crew
- `availability slack 0.15`: prefers no near-miss overlaps (e.g. back-to-back missions penalized slightly)

Return ranked list: `score + breakdown + gaps[]` (e.g. `needs piloting L3, has L2`). Lead picks from list to create `proposed` assignments.

Covers skills + availability + workload, deterministic, easy to demo and extend (resources = new weighted term).

Lock weights at 60/25/15 for v1?

---

<a id="turn-23"></a>
## Turn 23

**You**

What are the tradeoffs of introducing this scoring system? So far it I think it makes sense, the skill should have the highest amount. But what about workload and availability slack?

**Assistant**

Weighted sum is a guess presented as math - that's the trade-off. Pros: deterministic, explainable, 5 lines to retune. Cons: 60/25/15 is arbitrary, can hide a great-but-busy person behind a mediocre-but-free one.

Breakdown:
- **Skill 0.6 (highest):** correct - mission fails without capability. Must dominate.
- **Workload:** fairness/burnout - `active count` penalty spreads assignments. Risk: punishes your best people for being used.
- **Slack:** risk buffer - penalizes back-to-back missions even if dates don't overlap. Marginal value in v1, closest to creep.

Simplification: keep skill + workload only, make overload a hard cap (`max 2 active` configurable) + soft penalty. Drop slack term for now - derive availability purely from overlap. Less to justify, same demo impact.

---

<a id="turn-24"></a>
## Turn 24

**You**

I agree. Let's remove the slack for now. Right now it's not clear how well the matcher scoring will work until we try it out when we build it. This is fine for now.

**Assistant**

Locked for v1:

Hard: same-org, no date overlap (assignments + blocks), has ≥1 required skill.
Score: skill fit (~75%) + workload penalty (~25%), plus `gaps[]` explanation. Tune after seed demo.

Next: API + CLI surface (~10 endpoints mirroring `create → match → assign → submit → approve`)?

---

<a id="turn-25"></a>
## Turn 25

**You**

Ok let's continue

**Assistant**

Minimal surface for the flow:

**API (REST, headers `x-org-id` + `x-user-id`):**
- `POST /missions, GET /missions, GET /missions/:id`
- `POST /missions/:id/requirements` (lead/director)
- `GET /missions/:id/matches` (matcher)
- `POST /assignments` (from match), `POST /assignments/:id/respond` (`accept/decline`, crew)
- `POST /missions/:id/submit|approve|reject|activate|complete|cancel` - explicit, not `PATCH status`, so workflow is extensible
- `GET /crew, PATCH /users/:id/skills` (own or director), `POST /availability` (+ `GET/DELETE`)

**CLI mirrors 1:1:**
`missions create|list|show|submit|approve|...`, `match <mission-id>`, `assignments propose|respond`, `crew profile|availability add|list`, `skills add|list`

Explicit transition endpoints cost 6 tiny handlers but make approval redesign trivial live. Lock this?

---

<a id="turn-26"></a>
## Turn 26

**You**

What's the patch endpoint /users/:id/skills for? Also why x-org-id and x-user-id instead of passing in these fields as parameters in the REST endpoints?

**Assistant**

1. `PATCH /users/:id/skills` = update skill levels. Crew hits own id, director hits anyone's. That's the "manage skill profiles" requirement.

2. Headers = auth context, not resource data. If `org_id` is a body/query param per endpoint, any caller can change it to read another org - and you'll forget it on one endpoint and leak. With `x-org-id/x-user-id` (stub for a token), one middleware loads actor + enforces `resource.org_id == actor.org_id` for all routes. Still check `:id` ownership server-side.

---

<a id="turn-27"></a>
## Turn 27

**You**

Yeah that makes sense. Let's talk about x-user-id in more detail. Like you said it's used to stub for the auth token? Are there any alternatives for doing achieving the same result or do you believe this is the best way to handle auth?

**Assistant**

Best for MVP: single `x-user-id` only, derive org/role server-side. Two headers let a caller mix `user-A + org-B` - one header removes that class.

Alternatives:
- `?as=user` query - leaks in logs, worse
- Fake Bearer/JWT - same as header but more code for no gain
- Real auth - out of scope for 3-5hrs

CLI does `--as crew-1` → sends `x-user-id`. Server middleware `auth()` → `{user, org, role}` for all handlers. Replace that one function with JWT verify later - note it as extension point.

---

<a id="turn-28"></a>
## Turn 28

**You**

Ok gotcha, so both x-org-id and x-user-id are stubs for token as we don't want to implement real auth as that is overkill for a take home. If we assume x-user-id is the auth token for a user and it is secure, what about x-org-id? Can't we just swap the org-id to check another org's data? We are planning to check the org-id through some sort of middleware when performing operations in endpoints right?

**Assistant**

Exactly - never trust `x-org-id` from client. That's why we drop it.

V1: trust `x-user-id` as stub token (accepted risk, documented), then server loads `user → org_id` from DB. All queries add `WHERE org_id = actor.org_id`. Swapping IDs does nothing because org comes from the user row, not the request.

Real auth later just makes `x-user-id` unforgeable (JWT `sub`) - scoping logic stays identical.

---

<a id="turn-29"></a>
## Turn 29

**You**

Right now I feel like it is confusing to use x-user-id as the user's auth token but we would be introducing unnecessary overhead to generate a token each time we authorize a user in this demo right? We would need to store the token in SQLite and also add ways to login and logout in the demo?

**Assistant**

No token table or login needed - that's the point of the stub.

`x-user-id: crew-1` *is* the token for the demo. Seeded IDs are listed by `cli users list`, you pass one via `--as`. No login/logout, no session store.

Document as: "Demo auth - user ID acts as bearer token. Production replaces `auth()` with JWT verify." One function to swap later, zero overhead now.

---

<a id="turn-30"></a>
## Turn 30

**You**

Right now the brief doesn't state that a user would be in multiple orgs right? So going with the assumption that a user only has one org is fine? What do you think?

**Assistant**

Yes - single org per user. Brief says "Crew Members belong to an organisation" (singular), all data scoped to org.

Model it as `users.org_id` FK. Multi-org membership = join table + org-switching - pure extension material. Note it as non-goal in the doc.

---

<a id="turn-31"></a>
## Turn 31

**You**

Ok sounds good. Let's go with this API setup. What's next?

**Assistant**

Two short items to close design:

1. **Seed data** - 2 orgs (isolation demo), 1 director + 2 leads + 5 crew per org, skill catalog, 3 missions (one with skill gap, one with overlap conflict), blocks + assignments to make matcher show ranking/explanations
2. **Design doc outline** - context, assumptions, data model, lifecycle diagram, matcher, API/CLI, tenancy/RBAC enforcement, extension points/non-goals, run/verify steps

Lock seed scenarios, then we can draft the doc?

---

<a id="turn-32"></a>
## Turn 32

**You**

Yes this sounds perfect. Let's start creating the design doc

**Assistant**

Love it — drafting the design doc from our locked decisions now.

Drafted `DESIGN.md` from our locked decisions - stack, model, hierarchical roles + universal SoD, lifecycle table, matcher (skill .75 + workload .25, no slack), API/CLI surface, seed scenarios, non-goals/extensions.

Review it and tell me what to change - particularly the `accepted`-only overlap rule and weights, those are easiest to get wrong before code.

<details><summary>Tools: read×1, write×1</summary>

- `read`
- `write`

</details>

---

<a id="turn-33"></a>
## Turn 33

**You**

Be specific about what SoD is. Also does it make sense to create mermaid diagrams for the data model and mission state machine?

**Assistant**

Yes to both — clarifying SoD and adding the diagrams now.

Done:

- **SoD (§5.1):** spelled out as `mission.submitted_by != approver` for leads + directors, with 403 `SELF_APPROVAL` + example + audit columns. No ambiguity left for the agent.
- **Mermaid:** yes, added both - ER diagram (§4) and state diagram (§6). Lifecycle diagram is high-value (prevents illegal transitions in code); ER is cheap and helps reviewers + agent keep FKs right.

Worth keeping both - they render on GitHub with zero maintenance.

<details><summary>Tools: edit×3, read×1</summary>

- `read`
- `edit`
- `edit`
- `edit`

</details>

---

<a id="turn-34"></a>
## Turn 34

**You**

The newlines aren't rendering properly in the mermaid diagram

**Assistant**

Checking the diagram syntax.

Fixed - removed `\n` breaks, labels are now single-line `approve (actor != submitter)`. Mermaid state labels don't handle `\n` reliably on GitHub; single line always renders.

<details><summary>Tools: edit×1, read×1</summary>

- `read`
- `edit`

</details>

---

<a id="turn-35"></a>
## Turn 35

**You**

Is there anything else we are missing from the @take-home-brief.md ? I think we're pretty solid here especially with the diagrams but let me know

> 📎 `take-home-brief.md` — content in JSON export

**Assistant**

You're solid on core scope. 3 gaps vs brief:

1. **"Different approval processes"** - brief calls this out, our lifecycle is fixed single workflow. Add one line to non-goals: v1 single workflow for all orgs, per-org configurable workflow is explicit extension (that's your live-session hook).
2. **Agent guardrails** - brief grades the doc as agent instructions. Add build order + constraints: e.g. `1 schema → 2 auth/tenancy → 3 lifecycle → 4 matcher → 5 CLI`, "don't add ORM/auth lib, don't change state table without updating diagram."
3. **Run + submit artifacts** - doc has verify steps but brief wants "easy to run + seed + README" and transcripts. Need `README.md` (setup) alongside doc, and a note that this transcript thread is part of submission.

Add those and you're covered. Want me to patch them in?

---

<a id="turn-36"></a>
## Turn 36

**You**

Yes please!

**Assistant**

Adding the three missing pieces.

Patched:

- §12: single workflow for all orgs marked as deliberate non-goal, per-org configurability as extension
- §14: agent build order + guardrails (no ORM/auth lib, no state changes without diagram update, mandatory tenant tests)
- §15: README + transcripts as submission artifacts

<details><summary>Tools: edit×2</summary>

- `edit`
- `edit`

</details>

---

<a id="turn-37"></a>
## Turn 37

**You**

What is §? Could we not use that symbol as it's confusing?

**Assistant**

Replacing those markers with plain text.

Done - replaced both with `Section 5` / `Section 6`.

<details><summary>Tools: edit×2, grep×1</summary>

- `grep`
- `edit`
- `edit`

</details>

---

<a id="turn-38"></a>
## Turn 38

**You**

Ok how does the design doc look? The @take-home-brief.md brief mentions this is quite important and have covered the items that it is looking for in the design doc?

> 📎 `take-home-brief.md` — content in JSON export

**Assistant**

Reviewing the doc against the brief's checklist.

It covers what the brief grades:

- Multi-tenancy + roles: Sections 5, 8, 11 (middleware + 404-scoped + tests)
- Lifecycle/approval: Section 6 (state machine + SoD + transition table)
- Crew/skills: Sections 4, 8 (per-org catalog, 1-5 levels)
- Matcher thought: Section 7 (hard filters + weighted explainable score + gaps)
- CLI workflows: Section 9 (mirrors API 1:1, human + `--json`)
- Team-ready + agent-ready: Sections 11, 14 (layout + build order + constraints)
- Trade-offs/decisions: Sections 3, 12 (explicit assumptions + non-goals)

One cleanup: Section 7 line 99 still has `accepted|proposed?*` leftover - should read `accepted` only. Otherwise ready to freeze as v1 and build from it.

<details><summary>Tools: read×1</summary>

- `read`

</details>

---

<a id="turn-39"></a>
## Turn 39

**You**

Ok let's clean that up first

**Assistant**

Cleaning that up.

Cleaned - now reads `assignments(status=accepted)` with note that `proposed` doesn't block.

<details><summary>Tools: edit×1</summary>

- `edit`

</details>

---

<a id="turn-40"></a>
## Turn 40

**You**

Just wanted to clarify, how would we use the CLI? Show me an example

**Assistant**

Full loop, OrgA:

```bash
# discover users
npm run cli -- users list --as director-1

# lead plans
npm run cli -- missions create --title "Europa Survey" --start 2026-12-01 --end 2026-12-14 --as lead-1
npm run cli -- requirements add m1 --skill piloting --min-level 3 --count 2 --as lead-1

# match + staff
npm run cli -- match m1 --as lead-1
npm run cli -- assignments propose m1 crew-2 --as lead-1
npm run cli -- assignments propose m1 crew-3 --as lead-1

# submit + approve (SoD demo)
npm run cli -- missions submit m1 --as lead-1
npm run cli -- missions approve m1 --as lead-1       # fails 403 SELF_APPROVAL
npm run cli -- missions approve m1 --as lead-2       # succeeds

# crew responds + availability
npm run cli -- assignments respond a1 --accept --as crew-2
npm run cli -- availability add --start 2026-12-20 --end 2026-12-27 --reason leave --as crew-3
```

`--json` on any command for scripting, e.g. `match m1 --json`.

---
