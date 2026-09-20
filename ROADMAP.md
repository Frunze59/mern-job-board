# Implementation roadmap

The project skeleton is wired up (routing, folder structure, scripts). Every file
that still needs work has `TODO` comments describing exactly what to do. Work
through the steps in order; the app runs at every step.

Search for remaining work with:

```bash
grep -rn "TODO" server client/src --include=*.js --include=*.jsx
```

## Phase 1 — Backend

- [x] **1. Environment** — create `server/.env` from `.env.example`, add Atlas `MONGO_URL` and a `JWT_SECRET`. `npm run server` should log "Server is listening…".
- [x] **2. User model** (`server/models/User.js`) — schema fields, `pre('save')` bcrypt hash, `createJWT()`, `comparePassword()`.
- [x] **3. Auth controller** (`server/controllers/authController.js`) — `register` (201) and `login` (200/401). Test with curl/Postman.
- [x] **4. Auth middleware** (`server/middleware/auth.js`) — verify Bearer JWT, set `req.user.userId`, throw `UnauthenticatedError`.
- [x] **5. Job model** (`server/models/Job.js`) — fields, enums, defaults, `createdBy` ref.
- [x] **6. Jobs CRUD** (`server/controllers/jobsController.js`) — `createJob`, `updateJob`, `deleteJob` with `checkPermissions` (`server/utils/checkPermissions.js`).
- [x] **7. Query features** — `getAllJobs`: status / jobType filters, search regex, sort map, pagination, `{ jobs, totalJobs, numOfPages }`.
- [x] **8. Error handler polish** (`server/middleware/errorHandler.js`) — Mongoose ValidationError, duplicate key 11000, CastError.

## Phase 2 — Frontend

- [x] **9. Axios instance** (`client/src/utils/customFetch.js`) — request interceptor attaches token, response interceptor handles 401 (logout + redirect).
- [x] **10. Register / Login page** (`client/src/pages/Register.jsx`) — toggle forms, call API, store token + user in `localStorage`, redirect to `/dashboard`, inline errors.
- [x] **11. Dashboard context** (`client/src/context/DashboardContext.jsx`) — load user, `logout()`; wire Navbar logout and Profile page.
- [x] **12. Add Job page** (`client/src/pages/AddJob.jsx`) — shared `JobForm` component, POST, feedback.
- [x] **13. All Jobs page** (`client/src/pages/AllJobs.jsx`) — fetch with filters, render `JobCard`s, delete, `SearchContainer`, `PageBtnContainer`.
- [x] **14. Edit Job page** (`client/src/pages/EditJob.jsx`) — prefill via `GET /jobs/:id` + PATCH (consider a shared `JobForm` component).
- [x] **15. Styling** — `client/src/index.css` has base tokens; add layout / responsive tweaks.

## Phase 3 — Ship

- [x] **16. README** — notes written, live URL added.
- [x] **17. Deploy to Render** — build `npm run build`, start `npm start`, env vars, `NODE_ENV=production`.
- [x] **18. Final check** — register → add job → filter/search/paginate → edit → delete → logout → 404 page.

---

# v2 — Team Job Board

Branch: `feature/v2-team-job-board`, one PR to `main` at the end. Every file
below already exists as a skeleton with TODO comments; `docs/V2-ARCHITECTURE.md`
explains the design and `docs/adr/` the three decisions the brief asks about.

Order is chosen to de-risk: the test harness first because coverage is graded
and every later step should land with its tests; the migration early because it
touches live data and gates the deploy; the client last because it is the
smaller half of the grade.

## Phase 4 — Foundations

- [x] **19. Test harness** — `npm test` runs `tests/smoke.test.js` green (already does). Fill in `tests/regression-v1.test.js` so v1 behaviour is guarded before anything changes.
- [x] **20. Models** — `Organization` (slug generation, `personalFor` unique partial index, `findOrCreatePersonal()`), `Membership` (unique user+org), `Invitation` (`issue()`, `hashToken()`, `findByToken()`, `isExpired()`, `isUsable()`). `Job.organization` added with the `{ organization, createdAt }` index; **not yet required** (see step 22). 32 tests in `tests/models.test.js`.
- [x] **21. Personal org on register** — `authController.register` calls `Organization.ensurePersonalFor` (shared with the migration) and deletes the user if that step fails. 12 tests in `organizations.test.js`.
- [x] **22. Org context** — `Job.organization` now required. `resolveOrg` (X-Org-Id or Personal org, membership checked every request) and `requireRole` (fails at startup on an unknown role). Job writes gated to owner/recruiter; every job query scoped to the active org; `createdByName` via one batched author lookup. `checkPermissions` deleted. 26 tests in `roles.test.js`.

## Phase 5 — Features

- [x] **23. Migration** — `runMigration()` with per-user isolation, a resume rule for users whose jobs were never moved, a jobs-without-author warning, and `--dry-run` / `MIGRATE_DRY_RUN=1`. `render.yaml` start command is `npm run migrate && npm start`. 25 tests in `migration.test.js`, plus a rehearsal on data written by the real v1 code. **After merging, check the start command in the Render dashboard** (Settings); a blueprint sync should apply it, a hand-configured service will not.
- [x] **24. Orgs endpoints** — `GET /orgs` (personal first, with role), `POST /orgs` (unique slug, owner membership, rolls back the org if the membership fails), `GET /orgs/:orgId/members` (any member), `POST /orgs/:orgId/invitations` (owner only, returns `inviteUrl`, supersedes a pending invite for the same address). `CLIENT_URL` added to `.env.example`. 25 + 11 tests.
- [x] **25. Accept invitation** — `GET /invitations/:token` (renders the accept page), `POST /invitations/:token/accept` for both branches. Membership is written before the token is consumed, so a crash between the two never locks the invitee out. Invited new users get a Personal org too. 404 / 410 / 403 / 401 all covered; 33 tests in `invitations.test.js`.
- [x] **26. Stats** — one `$match` -> `$facet` -> `$project` pipeline; all counting in the database, JS only reshapes and zero-fills the six-month window. Months bucketed in UTC. `explain()` asserted to use `organization_1_createdAt_-1` with no COLLSCAN. 19 tests against a pinned clock.
- [x] **27. Seed + bench** — `seed-team.js` (1 org, 3 members, 500 jobs, deterministic; refuses a non-empty database or a SEED_URL matching MONGO_URL; `SEED_FORCE=1` wipes). `bench-stats.js` exits non-zero if p95 misses 200ms. Measured **p95 6.6ms**; evidence in `docs/PERF-stats.md`. 9 tests.
- [x] **28. Coverage** — `npm test -- --coverage` now works from the root (npm was eating the flag). **97.7% statements / 98% lines** on controllers, models, migrations and middleware, against the brief's 65% bar. Thresholds raised to just under the current figures so a regression fails the run. 190 tests.

## Phase 6 — Client

- [x] **29. Org plumbing** — `X-Org-Id` in `customFetch`, orgs + activeOrg + `canWrite` in `DashboardContext`, `OrgSwitcher` in the navbar, hide write buttons for viewers, show `createdByName` on cards.
- [x] **30. Team page** — members, invite form with copyable URL, create org.
- [x] **31. Accept-invite page** — both branches; optional RTL test.
- [x] **32. Stats page** — tiles, six CSS bars, top-companies table.

## Phase 7 — Ship

- [x] **33. Docs** — finalise the three ADRs, README: new endpoints + shapes, "Running the seed and migration scripts", link to `docs/adr/`.
- [x] **34. Deploy** — push branch, open the PR, merge, confirm the Render log shows the migration summary, hit `/stats` on the live URL.
- [x] **35. Regression on live** — register → create job → filter → paginate → delete, plus one invite flow end-to-end.
- [x] **36. Submit** — Loom (invite flow, `/stats` response, one ADR decision), PR link, one-paragraph self-review.
