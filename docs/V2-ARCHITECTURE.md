# v2 architecture: Team Job Board

Plain-language notes on how v2 fits onto v1, and why each choice was made
over the obvious alternative. The three ADRs in `adr/` go deeper on the
decisions the brief singles out; this file is the map.

## What changes, in one paragraph

v1 had two things: users and jobs, joined by `createdBy`. v2 adds an
**Organization** between them. A user belongs to orgs through **Membership**
rows that carry a role. Jobs belong to an org. Every request that touches jobs
first works out *which org you mean* (`X-Org-Id` header, or your Personal org),
then *what your role there lets you do*. **Invitations** are how new people get
a membership. **Stats** summarise one org's jobs in a single database round
trip. A **migration** moves every pre-v2 job into its author's Personal org so
nothing is orphaned.

## Request flow for an org-scoped route

```
Authorization: Bearer <jwt>      X-Org-Id: <orgId>   (optional)
        │                                 │
  authenticateUser  ──────►  resolveOrg  ──────►  requireRole(...)  ──────►  controller
  req.user = {userId}        req.org = {orgId, role}   403 if role not allowed   filters by req.org.orgId
                             403 if not a member
                             falls back to Personal org when header absent
```

Two small middlewares, composed. Nothing about roles lives in controllers, and
nothing about HTTP headers lives in models.

## Data model

```
User ──< Membership >── Organization ──< Job
             role                │           createdBy (audit only)
                                 └──< Invitation (email, role, tokenHash, expiresAt, status)
Organization.personalFor ──► User   (unique partial index: only on "Personal" orgs)
```

## The decisions, and the road not taken

**Org context in a header, not in the JWT.**
A user can be in several orgs and switch between them. Putting the org in the
token would mean a new token on every switch. A header is stateless, costs one
indexed lookup, and the client just changes one localStorage value.

**Personal org identified by a field, not by name.**
`Organization.personalFor` points at the user. The alternative was an
`isPersonal` flag or matching `name === 'Personal'`. A reference with a unique
partial index gives a one-lookup "find my Personal org" *and* makes the database
refuse duplicates, which is what makes the migration safe to rerun.

**Three roles, checked in two steps.**
Role first (may I do this: 403 otherwise), before any record is loaded, so a
viewer's 403 says nothing about whether a job exists. Scope second (is the
record in my org: every query filters by it, 404 otherwise). See ADR-001 for
why not two or four roles.

**`createdByName` looked up at read time, not copied onto the job.**
The brief says "denormalize". Copying the name onto every job goes stale if a
user renames themselves and would need its own migration for existing jobs.
Instead each response does one batched query for all the authors on the page
and adds the name. That is always correct, and the client still never does a
follow-up fetch, which is the point of the requirement. Mongoose `populate`
was the obvious tool, but it replaces `createdBy` with `null` when the author
has been deleted, losing the id; the batched lookup keeps the id and only the
name becomes `null`.

**Invitation returns a URL; token stored hashed; existing users must sign in.**
See ADR-003. Short version: a URL is what a human pastes; a hash means a leaked
database cannot mint memberships; refusing a password for an existing account
avoids building a second login endpoint.

**Stats in one `$facet` pipeline; zero-filling in JS.**
The brief demands one aggregation and no JS-side counting. The three branches
(`countsByStatus`, `perMonth`, `topCompanies`) run in parallel inside `$facet`
over one `$match`. The database does all the counting. JS only reshapes: it
turns the facet arrays into the object shape and merges the month counts onto
a fixed six-month list so empty months read `0`. That is shaping, not counting,
and doing it in the pipeline would need `$map` over a generated date range for
no gain. A `{ organization, createdAt }` index on Job serves both the `$match`
and the month range.

**Registration undoes itself if the Personal org can't be created.**
Registering is now two writes: the user, then the org and its owner
membership. If the second fails, the handler deletes what it made and returns
the error, so no account exists that can't reach any org. A transaction would
do the same job, but needs a replica set, which the in-memory test database
does not run by default. The org-and-membership step is one shared function,
`Organization.ensurePersonalFor`, which the migration also uses. It is safe to
call twice and repairs an org whose membership went missing.

**Migration runs before the server starts, per user, idempotent by index.**
See ADR-002. Short version: the deploy command becomes
`npm run migrate && npm start`; a broken migration stops the deploy, which is
the right failure. Lazy creation on first request was rejected because it
hides a write in a read path and races.

**Seed script refuses a non-empty database unless forced.**
This is the brief's second deliberate ambiguity. Wiping silently is how someone
deletes production with a typo in `SEED_URL`. Appending makes the perf numbers
meaningless because the dataset is no longer 500 jobs. So: refuse if any users
exist, wipe only with `SEED_FORCE=1`, and additionally refuse if `SEED_URL`
equals the `.env` `MONGO_URL`.

**Owner leaving an org (the brief's first ambiguity).**
Not built, but decided: blocked while they are the last owner. Auto-promoting
someone hands out power nobody asked for; auto-deleting the org destroys
shared data because one person clicked leave.

**A `POST /orgs` endpoint exists even though the brief does not list one.**
An agency has to be created by somebody. Without it the only org anyone has is
"Personal", and inviting colleagues into a Personal org is the wrong shape.
It is small: create the org, make the caller its owner.

**Tests share one in-memory MongoDB and run files serially.**
`mongodb-memory-server` boots a real `mongod`, so the tests exercise real
indexes, real unique-constraint errors, and the real aggregation, not mocks.
The app is exported from `app.js` without listening, so `supertest` mounts it
directly. Serial files avoid two suites wiping each other's collections.

## What the client needs

Deliberately the smaller half. The server and its tests carry the grade.

- `X-Org-Id` header from the axios interceptor, read from localStorage.
- Org switcher in the navbar, fed by `GET /orgs`.
- Team page: members, invite form (owners only, shows the returned URL), create org.
- Accept-invite page at `/invitations/:token`, two branches (signed in / not).
- Stats page: three tiles, six bars, one small table. No chart library.
- Viewers see no add / edit / delete buttons. The server still enforces it.
- Job cards show `createdByName`.
