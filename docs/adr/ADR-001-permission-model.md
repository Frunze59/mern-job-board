# ADR-001: Permission model

**Status:** accepted · **Date:** 2026-09-17

## Context

In v1 the only permission question was "is this record yours?", answered by
comparing `job.createdBy` to the JWT's `userId`. v2 needs two recruiters to
work the same pool of jobs and a hiring manager to watch without touching.
"Yours" stops being the right question.

## Decision

Three roles per organization: `owner`, `recruiter`, `viewer`, stored on a
`Membership` row linking a user to an org. Every org-scoped request answers
two questions, in order:

1. **Scope.** Is the record in my active organization? Controllers filter every
   query by `req.org.orgId`, which `resolveOrg` derives from the `X-Org-Id`
   header after confirming the caller holds a membership there. A job in
   another org is a 404, not a 403: it does not exist from where you stand.
2. **Role.** Does my role allow this action? `requireRole('owner','recruiter')`
   gates job writes; `owner` alone gates inviting. `checkPermissions` from v1
   is retired for jobs. `createdBy` stays as an audit trail only.

Why three and not two (member/viewer)? Somebody must be able to invite, and
giving that to every recruiter lets anyone grow the org. Why not more (admin,
billing)? No feature in scope needs them; a fourth role is a one-line enum
change when one does.

**If an owner leaves** (endpoint not built, but the rule is): blocked while they
are the last owner. Never auto-promote (silent privilege escalation), never
auto-delete (data loss from a misclick).

## Consequences

Role checks are middleware, so controllers stay readable. The viewer UI hides
write buttons, but the server is the real gate. Removing a member later must
respect the last-owner rule.
