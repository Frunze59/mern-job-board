# ADR-002: Legacy data migration

**Status:** accepted · **Date:** 2026-09-17

## Context

Existing jobs predate organizations, and v2 only lists jobs that belong to
one. They must land in an org before v2 serves requests, on every deploy.

## Decision

`001-orgs` gives each user a Personal org with an owner membership and moves
their unassigned jobs into it. Render runs `npm run migrate && npm start`;
the free plan has no separate pre-deploy step.

**Idempotency is enforced by indexes, not by care.** A unique partial index
on `Organization.personalFor` refuses a second Personal org, a unique
`(user, organization)` index refuses a second membership, and only jobs with
no organization are updated.

**I deviated from the brief's skip rule.** Skipping every user who has a
membership would strand jobs if a run crashed after the membership but before
the job update. A user is skipped only when they have a membership *and*
nothing left to move.

**Failures are isolated per user.** One user's error is logged, the rest
finish, and the rerun completes it. Any failure exits 1 and blocks startup:
a half-migrated server is worse than none.

**No downtime.** The migration only adds data, and v1 still finds jobs by
`createdBy`, so the old instance serves correctly while the new one migrates.
A rehearsal against real v1 code showed the cost: a job created through v1
*after* the migration stays unassigned until the next deploy's run sweeps it
up. On a single instance that window is seconds.

Rejected: creating orgs lazily on first request (a write hidden in a read
path, and it races) and transactions (the in-memory test database has no
replica set; per-user idempotent steps give the same safety).

## Consequences

`npm run migrate:dry-run` shows exactly what a deploy will do, so it can be
checked against production first.
