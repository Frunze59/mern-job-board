# Job Board — MERN Stack

A mini full‑stack **Job Board** application built with the MERN stack
(MongoDB, Express, React, Node.js). Users register/login, then create, list,
filter, paginate, edit and delete their own job applications.

- **Live app:** https://mern-job-board-e1td.onrender.com
- **Note:** the app is on Render's free tier, so the first request after a
  period of inactivity wakes the service and can take up to a minute.
- **Repo:** https://github.com/Frunze59/mern-job-board

## Features

- Register and log in; passwords hashed with bcryptjs, sessions carried by a JWT
  that expires after one day
- Every job belongs to the user who created it — the API scopes all reads to the
  signed-in user and refuses writes to anyone else's records
- Add, edit and delete jobs, each with a company, position, location, status and
  job type
- Filter by status and job type, search by position, sort four ways and page
  through the results, all handled server-side
- Protected dashboard routes, with an expired or invalid session logging the
  user out automatically
- Responsive layout down to a phone-sized screen

## Tech stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Backend  | Node.js (ES modules), Express 4, Mongoose, bcryptjs, jsonwebtoken, express-async-errors, dotenv |
| Frontend | React 19 (Vite), react-router-dom v6, axios, plain CSS               |
| Database | MongoDB Atlas                                                        |
| Tooling  | nodemon, concurrently                                                |

## Project structure

```
.
├── package.json          # root: `npm run dev` runs client + server via concurrently
├── .env.example          # all required environment variables (no values)
├── ROADMAP.md            # step-by-step implementation checklist
├── server/               # REST API
│   ├── server.js         # express app, route mounting, production static serving
│   ├── db/connect.js     # mongoose connection
│   ├── models/           # User.js (hashing, JWT), Job.js
│   ├── controllers/      # authController.js, jobsController.js
│   ├── routes/           # authRoutes.js, jobsRoutes.js
│   ├── middleware/       # auth.js (JWT), notFound.js, errorHandler.js
│   ├── errors/           # CustomAPIError + BadRequest / Unauthenticated / Forbidden / NotFound
│   └── utils/            # checkPermissions.js (owner-only guard)
└── client/               # React app (Vite)
    ├── vite.config.js    # dev proxy for /api, target read from server/.env PORT
    └── src/
        ├── App.jsx       # react-router-dom v6 route map
        ├── index.css     # all styling (tokens, layout, responsive)
        ├── pages/        # Landing, Register, DashboardLayout, ProtectedRoute,
        │                 # AllJobs, AddJob, EditJob, Profile, Error
        ├── components/   # JobForm (shared by add + edit), JobCard, SearchContainer,
        │                 # PageBtnContainer, Navbar, Sidebar, FormRow, FormRowSelect, Logo
        ├── context/      # DashboardContext (current user, logout)
        └── utils/        # customFetch.js (axios instance + interceptors),
                          # constants.js, formatDate.js
```

## Getting started (local development)

### Prerequisites

- Node.js 18+ and npm
- A MongoDB Atlas cluster (free tier is fine): https://www.mongodb.com/atlas

### 1. Clone and install

```bash
git clone https://github.com/Frunze59/mern-job-board.git
cd mern-job-board
npm run install-all      # installs root, server and client dependencies
```

### 2. Configure environment variables

Create `server/.env` (copy from `.env.example`) and fill in the values:

```bash
cp .env.example server/.env
```

| Variable       | Required | Description                                                       |
| -------------- | -------- | ----------------------------------------------------------------- |
| `PORT`         | no       | Port for the Express server, default `5000`. The Vite dev proxy reads this value, so changing it here is enough. |
| `MONGO_URL`    | yes      | MongoDB Atlas connection string.                                  |
| `JWT_SECRET`   | yes      | Secret used to sign JWTs. Use a long random string.               |
| `JWT_LIFETIME` | no       | JWT expiry, defaults to `1d`.                                     |
| `NODE_ENV`     | no       | `development` (default) or `production` (server also serves the built client). |

> `.env` is git‑ignored. Never commit real values.

### 3. Run in development

```bash
npm run dev
```

This starts both servers with `concurrently`:

- API: http://localhost:5000 (health check: `GET /api/v1/health`)
- Client: http://localhost:5173 (all `/api/*` requests are proxied to the API)

Other scripts:

```bash
npm run server     # API only (nodemon)
npm run client     # React only (vite)
npm run build      # install + build the client into client/dist
npm start          # run the API in production mode (serves client/dist when NODE_ENV=production)
```

## API reference

Base URL: `/api/v1`. All responses are JSON; errors have the shape `{ "msg": "..." }`.

### Auth — `/api/v1/auth`

| Method | Path        | Body                          | Response                                   |
| ------ | ----------- | ----------------------------- | ------------------------------------------ |
| POST   | `/register` | `{ name, email, password }`   | `201 { user: { name, email }, token }`     |
| POST   | `/login`    | `{ email, password }`         | `200 { user: { name, email }, token }`     |

Tokens expire after 1 day. Send them as `Authorization: Bearer <token>`.

### Jobs — `/api/v1/jobs` (auth required)

| Method | Path   | Description                                   |
| ------ | ------ | --------------------------------------------- |
| GET    | `/`    | List the logged‑in user's jobs (see filters)  |
| GET    | `/:id` | Get one job (owner only) — `200 { job }`      |
| POST   | `/`    | Create a job — `201 { job }`                  |
| PATCH  | `/:id` | Update a job (owner only) — `200 { job }`     |
| DELETE | `/:id` | Delete a job (owner only) — `200 { msg }`     |

**GET `/` query parameters**

| Param     | Values                                   | Default  |
| --------- | ---------------------------------------- | -------- |
| `status`  | `all`, `pending`, `interview`, `declined`| `all`    |
| `jobType` | `all`, `full-time`, `part-time`, `remote`| `all`    |
| `sort`    | `latest`, `oldest`, `a-z`, `z-a`         | `latest` |
| `search`  | case‑insensitive match on `position`     | —        |
| `page`    | page number                              | `1`      |
| `limit`   | jobs per page                            | `10`     |

Response: `{ "jobs": [...], "totalJobs": 42, "numOfPages": 5 }`

**Status codes:** 200, 201, 400 (validation), 401 (missing/invalid token),
403 (not the owner), 404 (not found).

## Deployment (Render)

A single web service serves both the API and the built client. The repo includes
a `render.yaml` blueprint, so the quickest route is **New > Blueprint** in Render
pointed at this repo; it will prompt for the two secrets. To configure a web
service by hand instead:

| Setting | Value |
| ------- | ----- |
| Runtime | Node |
| Build command | `npm run build` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

Environment variables: `NODE_ENV=production`, `JWT_LIFETIME=1d`, plus your real
`MONGO_URL` and `JWT_SECRET`. Do not set `PORT` — Render assigns it and the
server reads it from the environment.

**Why the build command installs dev dependencies for the client.** Setting
`NODE_ENV=production` makes `npm install` skip `devDependencies`, and `vite`
lives there, so a plain install leaves the build with `vite: not found`. The
build script passes `--include=dev` for the client to avoid that.

In production the Express server serves `client/dist` and falls back to
`index.html` for non‑API routes so React Router works on refresh.

**Atlas network access.** Render's free tier does not give a service a stable
outbound IP address, so an allowlist containing only your home address will fail
once deployed. Add `0.0.0.0/0` under Network Access in Atlas before the first
deploy. Access is still gated by the database user's credentials.

## Troubleshooting

**`EADDRINUSE: address already in use :::5000` on macOS.** Control Center's
AirPlay Receiver listens on port 5000. Either turn it off in
System Settings > General > AirDrop & Handoff > AirPlay Receiver, or set
`PORT=5001` in `server/.env`. The Vite dev proxy reads `PORT` from that file,
so no other change is needed.

Check what holds the port with:

```bash
lsof -nP -iTCP:5000 -sTCP:LISTEN
```

**`MongoServerError: bad auth` / authentication failed.** The password in
`MONGO_URL` is wrong, or it contains a character that breaks URL parsing
(`@ : / ? # %` or a space). Percent-encode it, or regenerate a password using
only letters and digits in Atlas under Database Access.

**Requests from the client 404 or hang.** Make sure the API is running and that
`PORT` in `server/.env` matches the port the server logs on startup.

## Notes

### Decisions worth explaining

**`createdBy` is never read from the request body.** It is taken from the
verified JWT on create, and update ignores it entirely, so a client cannot
create or reassign a job to another user.

**`PATCH` is a genuine partial update.** Only the fields present in the body are
changed. Sending `{ "status": "interview" }` leaves everything else untouched.

**A 401 from `/auth` does not trigger the logout interceptor.** The API answers
wrong credentials with 401, and a blanket redirect would reload the page and
destroy the inline error the login form is about to show. Only a 401 from
another endpoint is treated as an expired session.

**Search input is escaped before it reaches the regex.** Passing raw user text
to `$regex` means `.*` matches everything and a pattern like `(a+)+$` can pin a
CPU. The term is escaped so it matches literally.

**Every sort order has an `_id` tiebreaker.** Sorting by `position` alone leaves
rows with equal values in an arbitrary order that can differ between requests,
which makes a job appear on two pages while another disappears.

**Unexpected errors return a generic message.** Deliberate errors keep their own
text, but anything unrecognised is logged server-side and answered with
`Something went wrong, try again later`, so stack traces and driver internals
never reach the client.

**`GET /api/v1/jobs/:id` was added.** The brief's route table does not include
it, but without it the Edit page can only be filled from router state, which is
lost on a refresh. The route reuses the same ownership check as update and
delete.

### Verified against the deployment

The full API surface and the whole user journey were exercised against the live
URL above: register and login including the failure paths, create, list, filter,
search, sort, paginate, edit and delete, ownership rejections between two
accounts, logout, the protected-route redirect and the 404 page. Deep links and
a hard refresh resolve correctly, and the browser console is clean.

### What I skipped

- **No automated test suite.** Every step was verified against a real MongoDB and
  a real browser, and the throwaway scripts covered the API surface, the
  ownership rules and the query features. None of that is committed as a
  runnable `npm test`, which is the first thing I would add.
- **The token lives in `localStorage`.** The brief asks for the token in the
  response body rather than a cookie, so this follows it. It does mean the token
  is readable by any script on the page, and an `httpOnly` cookie with a refresh
  token would be the safer design.
- **No rate limiting on the auth endpoints**, so nothing slows down repeated
  login attempts.
- **The status and job type values are declared twice**, once in the Mongoose
  schema and once in the client constants. They are commented to point at each
  other, but nothing enforces that they stay in step.
- **Pagination renders one button per page.** Fine for a personal job list;
  with hundreds of pages it would need truncating.
- **The profile page is read-only**, matching the brief. There is no endpoint to
  change a name, email or password.

### With more time

1. Add automated tests: Supertest against an in-memory MongoDB for the API, and
   React Testing Library for the forms and the filter behaviour.
2. Move authentication to an `httpOnly` cookie with a short-lived access token
   and a refresh token.
3. Add `helmet`, `express-rate-limit` and input sanitisation.
4. Share the status and job type enums between client and server so they cannot
   drift apart.
5. Replace the loading text with skeleton cards, and update the list optimistically
   on delete rather than refetching.
6. Add the stats view the brief hints at: counts per status, and applications
   over time.
