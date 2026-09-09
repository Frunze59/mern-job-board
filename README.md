# Job Board — MERN Stack

A mini full‑stack **Job Board** application built with the MERN stack
(MongoDB, Express, React, Node.js). Users register/login, then create, list,
filter, paginate, edit and delete their own job applications.

- **Live app:** _TODO — Render URL_
- **Repo:** https://github.com/Frunze59/mern-job-board

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
│   ├── server.js         # express app, routes, error handling, production static serving
│   ├── db/connect.js     # mongoose connection
│   ├── models/           # User.js, Job.js
│   ├── controllers/      # authController.js, jobsController.js
│   ├── routes/           # authRoutes.js, jobsRoutes.js
│   ├── middleware/       # auth.js (JWT), notFound.js, errorHandler.js
│   ├── errors/           # CustomAPIError + BadRequest / Unauthenticated / Forbidden / NotFound
│   └── utils/            # checkPermissions.js (owner-only guard)
└── client/               # React app (Vite)
    ├── vite.config.js    # /api proxy -> http://localhost:5000
    └── src/
        ├── App.jsx       # react-router-dom v6 route map
        ├── pages/        # Landing, Register, DashboardLayout, AllJobs, AddJob, EditJob, Profile, Error, ProtectedRoute
        ├── components/   # Navbar, Sidebar, JobCard, SearchContainer, PageBtnContainer, FormRow, FormRowSelect, Logo
        ├── context/      # DashboardContext (user, logout)
        └── utils/        # customFetch.js (axios instance + interceptors), constants.js
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
| `PORT`         | no       | Port for the Express server. Defaults to `5000` (Vite proxy expects this in dev). |
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

Single web service serving both API and client:

- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Environment:** set `MONGO_URL`, `JWT_SECRET`, `JWT_LIFETIME`, `NODE_ENV=production`

In production the Express server serves `client/dist` and falls back to
`index.html` for non‑API routes so React Router works on refresh.

## Notes / possible improvements

_TODO — fill in before submission: what was skipped, what you would improve with more time._
