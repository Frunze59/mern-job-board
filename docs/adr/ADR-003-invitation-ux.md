# ADR-003: Invitation UX for new vs. existing users

**Status:** accepted · **Date:** 2026-09-17

## Context

One accept endpoint must serve an invitee who already has an account and one
who does not, and either may or may not be signed in when they click. Sending
email is out of scope.

## Decision

`POST /orgs/:orgId/invitations` returns a **full invite URL**, not a bare
token: a URL is what the owner pastes into Slack, whereas a token makes every
client rebuild the same string. `CLIENT_URL` sets its base, defaulting to the
request's own origin, which is right in production because the API serves the
client.

Only the token's SHA-256 hash is stored, so a leaked database cannot be turned
into memberships. Tokens expire in 7 days and are single-use, and re-inviting
an address supersedes any pending invitation, so a lost link can be reissued
and only the newest one works.

`POST /invitations/:token/accept` branches on the request, not the user:

- **Signed in:** their email must match the invitation, else 403. Membership
  created, token consumed.
- **Not signed in, email unknown:** `{ password, name? }` creates the account
  and membership and returns a JWT. Name defaults to the part before `@`.
- **Not signed in, email already registered:** 403, "sign in first". No
  password is accepted here.

That last rule is the deliberate one. Taking a password for an existing
account would make this a second login endpoint, with its own brute-force
surface, for a case the sign-in page already handles. The alternative,
forcing everyone to register first, would break the requirement to invite
people who have no account.

## Consequences

The accept page has two branches, chosen by whether a token is in storage.
Signed-out existing users get one extra step. The token rides in a URL, so it
lands in history and logs; expiry, single use and hashed storage limit what a
leak is worth.
