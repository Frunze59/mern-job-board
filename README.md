# Job Board — MERN Stack

A full‑stack **team job board** built with the MERN stack (MongoDB, Express,
React, Node.js). People sign up, work inside one or more **organizations**,
and share a pool of job applications with colleagues under one of three
roles. Jobs, stats and members are all scoped to the organization you are
currently in.

Built in two stages: v1 was a single-user job tracker, v2 added organizations,
roles, invitations, an aggregated stats endpoint and a migration that moves
the v1 data into the new shape. The v1 behaviour still works unchanged.

- **Live app:** https://mern-job-board-e1td.onrender.com
- **Note:** the app is on Render's free tier, so the first request after a
  period of inactivity wakes the service and can take up to a minute.
- **Repo:** https://github.com/Frunze59/mern-job-board

## Features

- Register and log in; passwords hashed with bcryptjs, sessions carried by a JWT
  that expires after one day
- **Organizations.** Every account gets a private `Personal` org on
  registration, and can create or be invited into shared ones. A switcher in
  the navbar picks the active org, which travels on every request
- **Three roles per organization** — `owner`, `recruiter`, `viewer`. Owners
  invite; owners and recruiters write jobs; viewers read. Enforced on the
  server on every request, not just hidden in the UI
- **Invitations by link.** An owner generates a single-use link that expires in
  7 days. It works whether the invitee already has an account or not; only a
  SHA-256 hash of the token is ever stored
- Add, edit and delete jobs, each with a company, position, location, status and
  job type — shared across the org, and stamped with who added them
- Filter by status and job type, search by position, sort four ways and page
  through the results, all handled server-side
- **Stats** for the active org — counts by status, the last six months, and the
  top three companies — from a single MongoDB aggregation, p95 well under the
  200 ms ceiling ([measurements](docs/PERF-stats.md))
- **An idempotent migration** that gives pre-v2 users a Personal org and moves
  their jobs into it, run automatically on every deploy
- Protected dashboard routes, with an expired or invalid session logging the
  user out automatically
- Responsive layout down to a phone-sized screen

## Tech stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Backend  | Node.js (ES modules), Express 4, Mongoose, bcryptjs, jsonwebtoken, express-async-errors, dotenv |
| Frontend | React 19 (Vite), react-router-dom v6, axios, plain CSS               |
| Database | MongoDB Atlas                                                        |
| Tests    | Vitest, supertest, mongodb-memory-server (API); React Testing Library (client) |
| CI       | GitHub Actions — both suites on every pull request                   |
| Tooling  | nodemon, concurrently, oxlint                                        |

## Project structure

```
.
├── package.json          # root: `npm run dev` runs client + server via concurrently
├── .env.example          # all required environment variables (no values)
├── render.yaml           # Render blueprint; start command runs the migration
├── ROADMAP.md            # step-by-step implementation checklist
├── .github/workflows/    # CI: server tests + coverage, client tests, lint, build
├── docs/
│   ├── adr/              # ADR-001 permissions, ADR-002 migration, ADR-003 invites
│   ├── V2-ARCHITECTURE.md# the v2 design and the roads not taken
│   └── PERF-stats.md     # how the stats p95 was measured, and the numbers
├── server/               # REST API
│   ├── app.js            # the express app, with no port and no DB — what tests mount
│   ├── server.js         # connects to Mongo and listens
│   ├── db/connect.js     # mongoose connection
│   ├── models/           # User, Job, Organization, Membership, Invitation
│   ├── controllers/      # auth, jobs, orgs, invitations, stats
│   ├── routes/           # authRoutes, jobsRoutes, orgsRoutes, invitationsRoutes, statsRoutes
│   ├── middleware/       # auth.js (JWT), resolveOrg.js (X-Org-Id), requireRole.js,
│   │                     # notFound.js, errorHandler.js
│   ├── migrations/       # 001-orgs.js — idempotent, runs on every deploy
│   ├── scripts/          # seed-team.js (1 org, 3 members, 500 jobs), bench-stats.js
│   ├── tests/            # vitest + supertest + mongodb-memory-server
│   └── errors/           # CustomAPIError + BadRequest / Unauthenticated / Forbidden / NotFound
└── client/               # React app (Vite)
    ├── vite.config.js    # dev proxy for /api, target read from server/.env PORT
    ├── vitest.config.js  # jsdom + React Testing Library
    └── src/
        ├── App.jsx       # react-router-dom v6 route map
        ├── index.css     # all styling (tokens, layout, responsive)
        ├── pages/        # Landing, Register, DashboardLayout, ProtectedRoute, AllJobs,
        │                 # AddJob, EditJob, Profile, Team, Stats, AcceptInvite, Error
        ├── components/   # JobForm, JobCard, SearchContainer, PageBtnContainer, Navbar,
        │                 # Sidebar, OrgSwitcher, MembersList, InviteForm, CreateOrgForm,
        │                 # ReadOnlyNotice, FormRow, FormRowSelect, Logo
        ├── context/      # DashboardContext (user, orgs, active org, canWrite)
        └── utils/        # customFetch.js (axios instance + interceptors),
                          # constants.js, formatDate.js
```

## Getting started (local development)

### Prerequisites

- Node.js 18+ and npm
- A MongoDB Atlas cluster (free tier is fine): https://www.mongodb.com/atlas

### 1. Clone and install

```bash
git clone https://github.com/Frunze59/mern-job-board.git
cd mern-job-board
npm run install-all      # installs root, server and client dependencies
```

### 2. Configure environment variables

Create `server/.env` (copy from `.env.example`) and fill in the values:

```bash
cp .env.example server/.env
```

| Variable       | Required | Description                                                       |
| -------------- | -------- | ----------------------------------------------------------------- |
| `PORT`         | no       | Port for the Express server, default `5000`. The Vite dev proxy reads this value, so changing it here is enough. |
| `MONGO_URL`    | yes      | MongoDB Atlas connection string.                                  |
| `JWT_SECRET`   | yes      | Secret used to sign JWTs. Use a long random string.               |
| `JWT_LIFETIME` | no       | JWT expiry, defaults to `1d`.                                     |
| `CLIENT_URL`   | no       | Base URL used to build invitation links, e.g. `http://localhost:5173` in development. When unset the server uses the request's own origin, which is correct in production because Express serves the built client. |
| `NODE_ENV`     | no       | `development` (default) or `production` (server also serves the built client). |

> `.env` is git‑ignored. Never commit real values.

### 3. Run in development

```bash
npm run dev
```

This starts both servers with `concurrently`:

- API: http://localhost:5000 (health check: `GET /api/v1/health`)
- Client: http://localhost:5173 (all `/api/*` requests are proxied to the API)

Other scripts:

```bash
npm run server        # API only (nodemon)
npm run client        # React only (vite)
npm run build         # install + build the client into client/dist
npm start             # run the API in production mode (serves client/dist when NODE_ENV=production)

npm test              # API test suite (no database needed)
npm test -- --coverage# the same, with the coverage report
npm run test:client   # React Testing Library
npm run test:all      # both suites

npm run migrate       # run the 001-orgs migration
npm run migrate:dry-run
npm run seed          # seed a dev database (see below)
npm run bench:stats   # time GET /stats against a running server
```

See [Running the seed and migration scripts](#running-the-seed-and-migration-scripts)
for what those last four do and when to use them.

## API reference

Base URL: `/api/v1`. All responses are JSON; errors have the shape `{ "msg": "..." }`.

### The active organization

Every request under `/jobs` and `/stats` happens inside one organization. The
client names it with a header:

```
Authorization: Bearer <token>
X-Org-Id: <organization id>
```

`X-Org-Id` is never trusted on its own — the server looks up your membership on
every request, so a role change or a removal takes effect immediately without
reissuing the token. **When the header is absent, the server falls back to your
`Personal` org**, which is what keeps a v1 client working unchanged against this
API.

| Situation | Response |
| --------- | -------- |
| Not a member of that org, or no such org | `403` (the same answer either way, so the header cannot be used to discover which org ids exist) |
| Malformed id | `400` |
| Your role may not do this | `403` |
| Record exists but in another org | `404` — from where you stand it does not exist |

### Auth — `/api/v1/auth`

| Method | Path        | Body                          | Response                                   |
| ------ | ----------- | ----------------------------- | ------------------------------------------ |
| POST   | `/register` | `{ name, email, password }`   | `201 { user: { name, email }, token }`     |
| POST   | `/login`    | `{ email, password }`         | `200 { user: { name, email }, token }`     |

Tokens expire after 1 day. Registering also creates that account's `Personal`
organization, with an `owner` membership in it.

### Organizations — `/api/v1/orgs` (auth required)

These name the org in the URL rather than the header, so they check membership
themselves.

| Method | Path                    | Role   | Body               | Response |
| ------ | ----------------------- | ------ | ------------------ | -------- |
| GET    | `/`                     | any    | —                  | `200 { orgs: [...] }` — every org you belong to, `Personal` first then by name |
| POST   | `/`                     | any    | `{ name }`         | `201 { org }` — you become its owner |
| GET    | `/:orgId/members`       | any member | —              | `200 { members: [...] }` |
| POST   | `/:orgId/invitations`   | **owner** | `{ email, role }` | `201 { invitation, inviteUrl }` |

```jsonc
// org
{ "_id": "...", "name": "Acme Recruiting", "slug": "acme-recruiting",
  "role": "owner", "isPersonal": false }

// member
{ "userId": "...", "name": "Bob Recruiter", "email": "bob@acme.test",
  "role": "recruiter", "joinedAt": "2026-09-18T10:00:00.000Z" }

// invitation response
{ "invitation": { "email": "dave@acme.test", "role": "recruiter",
                  "expiresAt": "2026-09-25T10:00:00.000Z" },
  "inviteUrl": "https://.../invitations/<raw token>" }
```

`POST /orgs` is not in the brief's route table. It was added because an
organization has to come from somewhere, and inviting colleagues into a
workspace called `Personal` would be the wrong shape — see
[ADR-001](docs/adr/ADR-001-permission-model.md).

**The raw token appears in that one response and nowhere else**; the database
stores only its SHA-256 hash. Nothing is emailed — the owner sends the link on
themselves. Re-inviting the same address supersedes any pending invitation, so
a lost link can be reissued and only the newest one works.

### Invitations — `/api/v1/invitations` (public)

Public on purpose: an invitee may not have an account yet. The accept handler
reads the `Authorization` header itself if one is present.

| Method | Path              | Body                  | Response |
| ------ | ----------------- | --------------------- | -------- |
| GET    | `/:token`         | —                     | `200 { email, role, orgName, expiresAt }` |
| POST   | `/:token/accept`  | see below             | see below |

`POST /:token/accept` branches on the request rather than on the user:

| Caller | Body | Response |
| ------ | ---- | -------- |
| Signed in, email matches the invitation | — | `200 { org, role }` |
| Signed in as somebody else | — | `403` — sign in as the invited address |
| Signed out, email not registered | `{ password, name? }` | `201 { user, token, org, role }` — creates the account too |
| Signed out, email already registered | — | `403` — sign in first, then reopen the link |

That last rule is deliberate, not an oversight; the reasoning and the
alternative are in [ADR-003](docs/adr/ADR-003-invitation-ux.md).

**Errors:** `404` unknown token · `410` expired or already used.

### Jobs — `/api/v1/jobs` (auth + active org)

Jobs belong to the organization, not to the person who typed them in. Any
writer in the org may edit any job in it; `createdBy` stays as an audit trail
and surfaces as `createdByName`.

| Method | Path   | Role                | Description |
| ------ | ------ | ------------------- | ----------- |
| GET    | `/`    | any                 | List the active org's jobs (see filters) |
| GET    | `/:id` | any                 | `200 { job }` |
| POST   | `/`    | owner, recruiter    | `201 { job }` |
| PATCH  | `/:id` | owner, recruiter    | `200 { job }` — genuine partial update |
| DELETE | `/:id` | owner, recruiter    | `200 { msg }` |

A `viewer` gets `403` on the three writes. The role is checked **before** the
record is loaded, so the answer is identical whether or not the job exists.

**GET `/` query parameters**

| Param     | Values                                   | Default  |
| --------- | ---------------------------------------- | -------- |
| `status`  | `all`, `pending`, `interview`, `declined`| `all`    |
| `jobType` | `all`, `full-time`, `part-time`, `remote`| `all`    |
| `sort`    | `latest`, `oldest`, `a-z`, `z-a`         | `latest` |
| `search`  | case‑insensitive match on `position`     | —        |
| `page`    | page number                              | `1`      |
| `limit`   | jobs per page (max 100)                  | `10`     |

```jsonc
{ "jobs": [ { "_id": "...", "company": "Acme", "position": "Backend Developer",
              "jobLocation": "Riga", "status": "pending", "jobType": "full-time",
              "createdBy": "...", "createdByName": "Alice Owner",
              "organization": "...", "createdAt": "...", "updatedAt": "..." } ],
  "totalJobs": 42, "numOfPages": 5 }
```

`createdByName` is resolved with one extra query for the whole page. It is
`null` when the author's account is gone — the id is kept either way, which is
why `populate` was not used.

### Stats — `/api/v1/stats` (auth + active org)

| Method | Path | Role | Response |
| ------ | ---- | ---- | -------- |
| GET    | `/`  | any  | `200` — the shape below. No query parameters. |

```jsonc
{
  "countsByStatus": { "pending": 167, "interview": 167, "declined": 166 },
  "applicationsPerMonth": [            // last 6 calendar months, oldest first,
    { "month": "2026-04", "count": 32 },// zeros filled in, bucketed in UTC
    { "month": "2026-05", "count": 40 }
    // ...
  ],
  "topCompanies": [                    // up to 3, count desc, ties by name asc
    { "company": "Fable Systems", "count": 19 },
    { "company": "Delta Labs", "count": 18 }
  ]
}
```

One `$match` → `$facet` → `$project` pipeline; nothing is counted in
JavaScript. Measured p95 and the reasoning are in
[docs/PERF-stats.md](docs/PERF-stats.md).

**Status codes across the API:** 200, 201, 400 (validation), 401
(missing/invalid token), 403 (wrong role, or not a member of that org), 404
(not found in the active org), 410 (invitation expired or used).

## Running the seed and migration scripts

Both live in `server/` and are exposed from the repo root.

### The migration — `001-orgs`

Gives every pre-v2 user a `Personal` organization with an `owner` membership,
and moves their jobs into it. It is what makes v1 data visible in v2.

```bash
npm run migrate:dry-run   # report what would change, write nothing
npm run migrate           # apply it
```

A dry run prints the same summary a real one would, so a deploy can be checked
against production data before it happens:

```
[migrate 001-orgs] DRY RUN, nothing written
[migrate 001-orgs]   users processed:                        2
[migrate 001-orgs]   orgs created:                           2
[migrate 001-orgs]   jobs migrated:                          3
[migrate 001-orgs]   users already migrated (skipped):       0
[migrate 001-orgs]   users resumed after an interrupted run: 0
[migrate 001-orgs]   users failed:                           0
```

- **It is idempotent**, and enforced by indexes rather than by care: a unique
  partial index on `Organization.personalFor` refuses a second `Personal` org,
  a unique `(user, organization)` index refuses a second membership, and only
  jobs with no organization are touched. Running it twice changes nothing the
  second time, which a test asserts.
- **It runs on every deploy.** `render.yaml` starts the service with
  `npm run migrate && npm start`, so a failed migration exits non-zero and the
  server never starts on half-migrated data.
- **A failure for one user does not stop the others.** The error is logged, the
  rest finish, and the next run completes the rest.

Reasoning, including the one place this deliberately deviates from the brief,
is in [ADR-002](docs/adr/ADR-002-legacy-data-migration.md).

### The seed — one org, three members, 500 jobs

Produces the dataset the performance ceiling is defined against: `Acme
Recruiting`, three members with one role each, and 500 jobs spread over the
last twelve months across ~40 companies.

```bash
SEED_URL="mongodb://127.0.0.1:27017/jobboard-dev" npm run seed
```

| Account            | Role      | Password      |
| ------------------ | --------- | ------------- |
| `alice@acme.test`  | owner     | `Password123` |
| `bob@acme.test`    | recruiter | `Password123` |
| `cara@acme.test`   | viewer    | `Password123` |

**What it does about existing data** (one of the brief's open questions): it
**refuses to run against a database that already has users**, unless
`SEED_FORCE=1` is set, in which case it wipes the five collections first.

```bash
SEED_URL="..." SEED_FORCE=1 npm run seed   # wipe, then seed
```

Appending was rejected because the dataset would no longer be the 500 jobs the
p95 target is defined against, so the benchmark would stop meaning anything.
Wiping silently was rejected because that is exactly how a typo in a connection
string destroys real data. It also refuses when `SEED_URL` equals `MONGO_URL`
from your `.env`, so the app's own database cannot be seeded by accident.

The data is generated from a fixed seed, so every run produces the same dataset
and benchmark numbers stay comparable.

### The benchmark

```bash
BENCH_URL=http://localhost:5000 npm run bench:stats
```

200 timed requests after 10 warmup, against a running server seeded as above.
It exits non-zero if p95 reaches 200 ms, so it can gate a deploy. Full method
and results: [docs/PERF-stats.md](docs/PERF-stats.md).

## Tests

```bash
npm test                 # API: vitest + supertest + mongodb-memory-server
npm test -- --coverage   # the same, with the coverage report
npm run test:client      # React Testing Library, in jsdom
npm run test:all         # both suites
```

No database is needed for either. The API suite starts an in-memory MongoDB and
mounts the real Express app through supertest; the first run downloads a
`mongod` binary and caches it.

| Suite  | Tests | Covers |
| ------ | ----- | ------ |
| Server | 190   | invitations (both invitee branches), role enforcement, org scoping, stats accuracy against a fixed fixture, migration idempotency, the seed, the error handler, and a v1 regression file |
| Client | 21    | the invite-acceptance page and the stats page |

Coverage is measured on `controllers`, `models`, `migrations` and `middleware`,
and currently sits at **97.7% statements / 94.3% branches**. The thresholds in
`server/vitest.config.js` are set just under those figures rather than at the
brief's 65% bar, so a regression fails the run instead of quietly eroding
toward it.

Both suites run in GitHub Actions on every pull request.

## Architecture and decisions

- **[docs/adr/](docs/adr/)** — the three architecture decision records:
  - [ADR-001: Permission model](docs/adr/ADR-001-permission-model.md) — why
    three roles, and why v1's `checkPermissions` was deleted rather than kept
  - [ADR-002: Legacy data migration](docs/adr/ADR-002-legacy-data-migration.md)
    — idempotency, partial failures, and deploying without downtime
  - [ADR-003: Invitation UX](docs/adr/ADR-003-invitation-ux.md) — the invitee
    who already has an account, and what the alternative would have cost
- **[docs/V2-ARCHITECTURE.md](docs/V2-ARCHITECTURE.md)** — the v2 design, the
  request flow for an org-scoped route, and the options that were rejected
- **[docs/PERF-stats.md](docs/PERF-stats.md)** — how the stats p95 was measured,
  the numbers, and why the pipeline is fast

## Deployment (Render)

A single web service serves both the API and the built client. The repo includes
a `render.yaml` blueprint, so the quickest route is **New > Blueprint** in Render
pointed at this repo; it will prompt for the two secrets. To configure a web
service by hand instead:

| Setting | Value |
| ------- | ----- |
| Runtime | Node |
| Build command | `npm run build` |
| Start command | `npm run migrate && npm start` |
| Health check path | `/api/v1/health` |

Environment variables: `NODE_ENV=production`, `JWT_LIFETIME=1d`, plus your real
`MONGO_URL` and `JWT_SECRET`. Do not set `PORT` — Render assigns it and the
server reads it from the environment. `CLIENT_URL` can be left unset in
production; invitation links then use the request's own origin, which is this
same service.

**The start command runs the migration first.** Render's free plan has no
separate pre-deploy step, so `npm run migrate && npm start` is how `001-orgs`
gets to run. If it fails it exits non-zero and the server never starts, which
is the intended behaviour: a half-migrated API is worse than a deploy that
visibly stops. The migration only adds data and v1 still finds jobs by
`createdBy`, so the previous instance keeps serving correctly while the new one
migrates — see [ADR-002](docs/adr/ADR-002-legacy-data-migration.md).

**Why the build command installs dev dependencies for the client.** Setting
`NODE_ENV=production` makes `npm install` skip `devDependencies`, and `vite`
lives there, so a plain install leaves the build with `vite: not found`. The
build script passes `--include=dev` for the client to avoid that.

In production the Express server serves `client/dist` and falls back to
`index.html` for non‑API routes so React Router works on refresh.

**Atlas network access.** Render's free tier does not give a service a stable
outbound IP address, so an allowlist containing only your home address will fail
once deployed. Add `0.0.0.0/0` under Network Access in Atlas before the first
deploy. Access is still gated by the database user's credentials.

## Troubleshooting

**`EADDRINUSE: address already in use :::5000` on macOS.** Control Center's
AirPlay Receiver listens on port 5000. Either turn it off in
System Settings > General > AirDrop & Handoff > AirPlay Receiver, or set
`PORT=5001` in `server/.env`. The Vite dev proxy reads `PORT` from that file,
so no other change is needed.

Check what holds the port with:

```bash
lsof -nP -iTCP:5000 -sTCP:LISTEN
```

**`MongoServerError: bad auth` / authentication failed.** The password in
`MONGO_URL` is wrong, or it contains a character that breaks URL parsing
(`@ : / ? # %` or a space). Percent-encode it, or regenerate a password using
only letters and digits in Atlas under Database Access.

**Requests from the client 404 or hang.** Make sure the API is running and that
`PORT` in `server/.env` matches the port the server logs on startup.

## Notes

### Decisions worth explaining

**`createdBy` is never read from the request body.** It is taken from the
verified JWT on create, and update ignores it entirely, so a client cannot
create or reassign a job to another user.

**`PATCH` is a genuine partial update.** Only the fields present in the body are
changed. Sending `{ "status": "interview" }` leaves everything else untouched.

**A 401 from `/auth` does not trigger the logout interceptor.** The API answers
wrong credentials with 401, and a blanket redirect would reload the page and
destroy the inline error the login form is about to show. Only a 401 from
another endpoint is treated as an expired session.

**Search input is escaped before it reaches the regex.** Passing raw user text
to `$regex` means `.*` matches everything and a pattern like `(a+)+$` can pin a
CPU. The term is escaped so it matches literally.

**Every sort order has an `_id` tiebreaker.** Sorting by `position` alone leaves
rows with equal values in an arbitrary order that can differ between requests,
which makes a job appear on two pages while another disappears.

**Unexpected errors return a generic message.** Deliberate errors keep their own
text, but anything unrecognised is logged server-side and answered with
`Something went wrong, try again later`, so stack traces and driver internals
never reach the client.

**`GET /api/v1/jobs/:id` was added.** The brief's route table does not include
it, but without it the Edit page can only be filled from router state, which is
lost on a refresh. In v2 it is scoped to the active org like every other read.

**Role is checked before the record is loaded.** A viewer attempting a write
gets the same 403 whether or not the job exists, so the error cannot be used to
probe which ids are real.

**A missing `X-Org-Id` falls back to the `Personal` org** rather than being an
error. That is what lets a v1 client keep working against the v2 API unchanged,
and it is what the regression test file relies on.

**Month labels on the stats page are split out of the string, not parsed as a
`Date`.** `new Date("2026-04")` is midnight UTC, so formatting it in any
timezone behind UTC prints March and every bar carries the wrong month. The
server buckets in UTC deliberately; reading the parts directly is the only way
to guarantee the label matches the bucket. The bug is invisible from a UTC+
machine, which is how it would have shipped.

**The client hides what your role cannot do, but that is only courtesy.** Write
buttons, the `add job` link and the invite form disappear for the roles that
cannot use them, so nobody fills in a form that was always going to be refused.
Every one of those actions is still checked on the server, and the API refuses
them the same way whether or not the button was on screen.

### Verified by hand

Beyond the automated suites, both versions were driven through a real browser.

**v1, against the live deployment:** register and login including the failure
paths, create, list, filter, search, sort, paginate, edit and delete, ownership
rejections between two accounts, logout, the protected-route redirect and the
404 page. Deep links and a hard refresh resolve correctly, and the browser
console is clean.

**v2, against a seeded database:** the three-role dataset from the seed script,
driven in a browser at both desktop and 375px widths.

- The same account in two orgs sees write controls in one and not the other,
  and the list refetches on switch
- A viewer typing `/dashboard/add-job` gets an explanation, and the API refuses
  the same call directly
- An owner issues an invite link; a failed second invite leaves the first link
  on screen, because that token exists in one response and nowhere else
- All seven states of the accept page: unknown token, spent token, a brand-new
  account created and landed straight in the org, an address that already has
  an account, signed in as the wrong person, the confirm branch, and recovery
  from a stale session without losing the invite URL
- Stats tiles, bars and table match the raw JSON, including the tie between two
  companies on the same count being broken by name

The v2 live pass is the same list run against the deployment once this branch
is merged.

### What I skipped

- **No endpoint to leave an organization or remove a member.** The brief raised
  the question without requiring the endpoint. The decision is recorded in
  [ADR-001](docs/adr/ADR-001-permission-model.md): a leave would be blocked
  while you are the last owner, because auto-promoting hands power to somebody
  who did not ask for it and auto-deleting destroys shared data from one click.
  Nothing enforces that rule today, because nothing can leave.
- **Pending invitations are not listed anywhere.** An owner can issue a link and
  supersede it by re-inviting the address, but cannot see what is outstanding or
  revoke one without issuing another. A `GET /orgs/:orgId/invitations` and a
  delete would close that.
- **Roles cannot be changed after the fact.** A member joins with the role in
  their invitation and keeps it. The data model supports a change — the role
  lives on the `Membership` row and is read fresh on every request — but there
  is no endpoint.
- **The token lives in `localStorage`.** The brief asks for the token in the
  response body rather than a cookie, so this follows it. It does mean the token
  is readable by any script on the page, and an `httpOnly` cookie with a refresh
  token would be the safer design.
- **No rate limiting on the auth endpoints**, so nothing slows down repeated
  login attempts.
- **The status and job type values are declared twice**, once in the Mongoose
  schema and once in the client constants. They are commented to point at each
  other, but nothing enforces that they stay in step.
- **Pagination renders one button per page.** That was fine for a personal job
  list; a shared org is larger, and the seeded 500 jobs already produce 50
  buttons. It needs truncating.
- **The profile page is read-only**, matching the brief. There is no endpoint to
  change a name, email or password.

### With more time

1. Member management: change a role, remove a member, leave an org, and the
   last-owner rule from ADR-001 that all three need.
2. List and revoke pending invitations, so an owner can see what is outstanding.
3. Move authentication to an `httpOnly` cookie with a short-lived access token
   and a refresh token.
4. Add `helmet`, `express-rate-limit` and input sanitisation.
5. Share the status, job type and role enums between client and server so they
   cannot drift apart. They are commented to point at each other today, but
   nothing enforces it.
6. Extend the client test suite past the two pages it covers, and add an
   end-to-end test for the whole invite flow against a running server.
7. Replace the loading text with skeleton cards, and update the list
   optimistically on delete rather than refetching.
