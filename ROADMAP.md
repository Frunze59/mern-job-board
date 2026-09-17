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
- [ ] **21. Personal org on register** — `authController.register` creates the org + owner membership. Test in `organizations.test.js`.
- [ ] **22. Org context** — make `Job.organization` required (deferred from step 20, because requiring it before `createJob` sets it breaks job creation). Implement `resolveOrg` and `requireRole`; wire `requireRole('owner','recruiter')` on job writes in `jobsRoutes.js`. Jobs controllers: filter by `req.org.orgId` instead of `createdBy`; set `organization` on create; add `createdByName` via populate. Retire `checkPermissions` for jobs. Tests in `roles.test.js`.

## Phase 5 — Features

- [ ] **23. Migration** — `migrations/001-orgs.js` with `runMigration()` exported. `migration.test.js` runs it twice and asserts counts. Then set `startCommand: npm run migrate && npm start` in `render.yaml`.
- [ ] **24. Orgs endpoints** — `GET /orgs`, `POST /orgs`, `GET /orgs/:orgId/members`, `POST /orgs/:orgId/invitations` (owner only, returns `inviteUrl`). Add `CLIENT_URL` to `.env.example`.
- [ ] **25. Accept invitation** — `GET /invitations/:token`, `POST /invitations/:token/accept`, both branches, 404 / 410 / 403 paths. Tests in `invitations.test.js`.
- [ ] **26. Stats** — `buildStatsPipeline(orgId, now)` + `getStats`. Deterministic fixture test with a fixed `now`. Confirm `explain()` shows the index.
- [ ] **27. Seed + bench** — `scripts/seed-team.js` (refuse / `SEED_FORCE=1`), `scripts/bench-stats.js`. Run both against a dev database; save the p95 output for the PR.
- [ ] **28. Coverage** — `npm test -- --coverage` ≥ 65% on controllers / models / migrations. Fill gaps before touching the client.

## Phase 6 — Client

- [ ] **29. Org plumbing** — `X-Org-Id` in `customFetch`, orgs + activeOrg + `canWrite` in `DashboardContext`, `OrgSwitcher` in the navbar, hide write buttons for viewers, show `createdByName` on cards.
- [ ] **30. Team page** — members, invite form with copyable URL, create org.
- [ ] **31. Accept-invite page** — both branches; optional RTL test.
- [ ] **32. Stats page** — tiles, six CSS bars, top-companies table.

## Phase 7 — Ship

- [ ] **33. Docs** — finalise the three ADRs, README: new endpoints + shapes, "Running the seed and migration scripts", link to `docs/adr/`.
- [ ] **34. Deploy** — push branch, open the PR, merge, confirm the Render log shows the migration summary, hit `/stats` on the live URL.
- [ ] **35. Regression on live** — register → create job → filter → paginate → delete, plus one invite flow end-to-end.
- [ ] **36. Submit** — Loom (invite flow, `/stats` response, one ADR decision), PR link, one-paragraph self-review.
