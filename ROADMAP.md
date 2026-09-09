# Implementation roadmap

The project skeleton is wired up (routing, folder structure, scripts). Every file
that still needs work has `TODO` comments describing exactly what to do. Work
through the steps in order; the app runs at every step.

Search for remaining work with:

```bash
grep -rn "TODO" server client/src --include=*.js --include=*.jsx
```

## Phase 1 — Backend

- [ ] **1. Environment** — create `server/.env` from `.env.example`, add Atlas `MONGO_URL` and a `JWT_SECRET`. `npm run server` should log "Server is listening…".
- [ ] **2. User model** (`server/models/User.js`) — schema fields, `pre('save')` bcrypt hash, `createJWT()`, `comparePassword()`.
- [ ] **3. Auth controller** (`server/controllers/authController.js`) — `register` (201) and `login` (200/401). Test with curl/Postman.
- [ ] **4. Auth middleware** (`server/middleware/auth.js`) — verify Bearer JWT, set `req.user.userId`, throw `UnauthenticatedError`.
- [ ] **5. Job model** (`server/models/Job.js`) — fields, enums, defaults, `createdBy` ref.
- [ ] **6. Jobs CRUD** (`server/controllers/jobsController.js`) — `createJob`, `updateJob`, `deleteJob` with `checkPermissions` (`server/utils/checkPermissions.js`).
- [ ] **7. Query features** — `getAllJobs`: status / jobType filters, search regex, sort map, pagination, `{ jobs, totalJobs, numOfPages }`.
- [ ] **8. Error handler polish** (`server/middleware/errorHandler.js`) — Mongoose ValidationError, duplicate key 11000, CastError.

## Phase 2 — Frontend

- [ ] **9. Axios instance** (`client/src/utils/customFetch.js`) — request interceptor attaches token, response interceptor handles 401 (logout + redirect).
- [ ] **10. Register / Login page** (`client/src/pages/Register.jsx`) — toggle forms, call API, store token + user in `localStorage`, redirect to `/dashboard`, inline errors.
- [ ] **11. Dashboard context** (`client/src/context/DashboardContext.jsx`) — load user, `logout()`; wire Navbar logout and Profile page.
- [ ] **12. Add Job page** (`client/src/pages/AddJob.jsx`) — form with `FormRow` / `FormRowSelect`, POST, feedback.
- [ ] **13. All Jobs page** (`client/src/pages/AllJobs.jsx`) — fetch with filters, render `JobCard`s, delete, `SearchContainer`, `PageBtnContainer`.
- [ ] **14. Edit Job page** (`client/src/pages/EditJob.jsx`) — prefill + PATCH (consider a shared `JobForm` component).
- [ ] **15. Styling** — `client/src/index.css` has base tokens; add layout / responsive tweaks.

## Phase 3 — Ship

- [ ] **16. README** — fill in the live URL and the "Notes / possible improvements" section.
- [ ] **17. Deploy to Render** — build `npm run build`, start `npm start`, env vars, `NODE_ENV=production`.
- [ ] **18. Final check** — register → add job → filter/search/paginate → edit → delete → logout → 404 page.
