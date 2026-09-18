# `GET /api/v1/stats` timing

Evidence for the brief's requirement: **p95 < 200 ms** on 500 jobs across
3 members of one organization.

## How to reproduce

```bash
# 1. a throwaway database
docker run -d --rm --name jobboard-bench-mongo -p 27018:27017 mongo:7

# 2. seed one org, 3 members, 500 jobs over the last 12 months
SEED_URL="mongodb://127.0.0.1:27018/seed-dev" npm run seed

# 3. run the API against it
cd server && PORT=5099 MONGO_URL="mongodb://127.0.0.1:27018/seed-dev" \
  JWT_SECRET=bench-secret node server.js

# 4. 200 requests after 10 warmup, logging in as the seeded owner
BENCH_URL=http://localhost:5099 npm run bench:stats
```

## Result

Measured 18 September 2026, MacBook Pro (Apple silicon, macOS 27), Node 22,
MongoDB 7 in Docker on the same machine. 200 requests after 10 warmup.

```
[bench] GET /api/v1/stats   http://localhost:5099
[bench] org "Acme Recruiting" with 500 jobs, 200 requests after 10 warmup
[bench]   min   3.1 ms
[bench]   p50   4.2 ms
[bench]   p95   6.6 ms
[bench]   p99   7.5 ms
[bench]   max   8 ms
[bench] target p95 < 200 ms -> PASS
```

**p95 = 6.6 ms**, roughly 30x inside the ceiling. `npm run bench:stats` exits
non-zero if p95 ever misses the target, so it can gate CI.

## Why it is fast

The whole endpoint is one aggregation: a single `$match` on the organization,
a `$facet` running the three branches in parallel over that match, and a
`$project` to shape the output. No per-branch round trip, and no counting in
JavaScript.

`Job` carries a `{ organization: 1, createdAt: -1 }` index, which serves both
the `$match` and the six-month range in the month branch. A test asserts on
`explain()` that the pipeline uses `organization_1_createdAt_-1` and never
falls back to a collection scan, so a regression here fails the suite rather
than quietly slowing the endpoint down.

Note these numbers are local. On Render's free tier the database is a remote
Atlas cluster, so the round trip adds tens of milliseconds, and a cold start
adds up to a minute before the first request.
