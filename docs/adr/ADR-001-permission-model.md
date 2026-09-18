# ADR-001: Permission model

**Status:** accepted · **Date:** 2026-09-17

## Context

In v1 the only permission question was "is this record yours?", answered by
comparing `job.createdBy` to the JWT's `userId`. v2 needs two recruiters to
work the same pool of jobs and a hiring manager to watch without touching.
"Yours" stops being the right question.

## Decision

Three roles per organization, `owner`, `recruiter` and `viewer`, stored on a
`Membership` row. Every org-scoped request answers two questions, in order:

1. **Role.** May my role in the active org do this? `requireRole` gates job
   writes to owners and recruiters, and invitations to owners. It runs before
   any record is loaded, so a viewer's 403 is identical whether or not the
   job exists.
2. **Scope.** Is the record in my active org? Every query filters by the org
   that `resolveOrg` accepted from `X-Org-Id` after checking membership. A job
   elsewhere is a 404: from where you stand, it does not exist.

v1's `checkPermissions` is deleted rather than kept alongside. Any recruiter
may edit any job in their org, so authorship grants nothing; `createdBy`
remains as an audit trail. Roles are read on every request, not stored in
the JWT, so a demotion takes effect immediately.

Why not two roles? Someone must be able to invite, and giving that to every
recruiter lets anyone grow the org. Why not four? Nothing in scope needs an
admin or billing role, and adding one is a one-line enum change.

**If an owner leaves** (not built, but decided): blocked while they are the
last owner. Auto-promoting grants power nobody asked for; auto-deleting
destroys shared data from one click.

## Consequences

Controllers stay readable because role checks are middleware. The viewer UI
hides write buttons, but the server is the real gate. A future
remove-member endpoint must enforce the last-owner rule.
