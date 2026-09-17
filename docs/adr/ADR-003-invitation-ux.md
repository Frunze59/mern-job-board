# ADR-003: Invitation UX for new vs. existing users

**Status:** accepted · **Date:** 2026-09-17

## Context

One accept endpoint must serve an invitee who already has an account and one
who does not, and the invitee may or may not be signed in when they click.
Sending email is out of scope.

## Decision

`POST /orgs/:orgId/invitations` returns a **full invite URL**, not a bare
token. A URL is what the owner actually pastes into Slack or an email; a token
would make every client rebuild the same string. The token is 32 random bytes
and only its SHA-256 hash is stored, so a database leak cannot be turned into
memberships. It expires in 7 days and is single-use.

`POST /invitations/:token/accept` branches on the request, not on the user:

- **Authorization header present:** the signed-in user's email must equal the
  invitation's, else 403. Membership is created and the token consumed.
- **No header, email not registered:** body `{ password, name? }` creates the
  account, the membership, and returns a JWT. Name defaults to the part of the
  email before `@`.
- **No header, email already registered:** 403 with "sign in first". We do
  **not** accept a password here.

That last rule is the deliberate choice. Accepting a password for an existing
account would turn the accept endpoint into a second login, with its own
brute-force surface and error messages, for a case the sign-in page already
handles. The alternative of forcing everyone to register before accepting
would break the requirement to invite people who have no account yet.

## Consequences

The accept page has two visual branches, driven by whether a token is in
storage. Existing users who are signed out get one extra step. Because the
token travels in a URL it will sit in browser history and logs; expiry,
single use and hashed storage limit the damage if one leaks.
