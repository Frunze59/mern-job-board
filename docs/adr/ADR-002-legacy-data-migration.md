# ADR-002: Legacy data migration

**Status:** accepted · **Date:** 2026-09-17

## Context

Existing users and their jobs predate organizations. `Job.organization`
becomes required and is the source of truth for permissions, so every old job
must land in an org before the v2 code serves a single request, and the
migration must be safe to run on every deploy.

## Decision

`server/migrations/001-orgs.js` gives each user without a membership a
"Personal" org, an `owner` membership, and moves their jobs into it. It runs
in the Render start command ahead of the server: `npm run migrate && npm start`.

Idempotency is enforced by the database, not by promises in code:

- `Organization.personalFor` carries a **unique partial index**, so a second
  Personal org for the same user is impossible even if the script crashes
  between creating the org and creating the membership.
- `Membership` has a unique `(user, organization)` index.
- Jobs are matched with `organization: { $exists: false }`, so a moved job is
  never touched again.

Each user is processed independently. A **partial failure** leaves every
other user complete and the failed one untouched; the rerun finds the
half-made Personal org through `personalFor` and finishes it.

Why not create the Personal org lazily on first request? That hides a write
inside a read path, races under concurrent requests, and leaves stats and
listing broken until that first request happens. Why not a transaction?
Atlas supports them, but the in-memory test server needs replica-set setup
to match; idempotent per-user steps give the same safety with less machinery.

## Consequences

A failing migration blocks the deploy. That is intended: a half-migrated app
that is running is worse than one that refused to start. The script must exit
0 when there is nothing to do, and its summary line is the deploy's evidence.
