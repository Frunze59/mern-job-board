/**
 * bench-stats: measure GET /api/v1/stats against a running server, to show
 * the brief's p95 < 200ms on the seeded 500-job dataset.
 *
 *   BENCH_URL=http://localhost:5000 npm run bench:stats
 *
 * Defaults to the seed script's owner account. Override with BENCH_EMAIL,
 * BENCH_PASSWORD, BENCH_RUNS (default 200) and BENCH_WARMUP (default 10).
 *
 * Exits 1 if p95 misses the target, so it can gate a deploy or CI.
 */
import { SEED_PASSWORD, TEAM } from './seed-team.js';

const TARGET_P95_MS = 200;

const percentile = (sorted, fraction) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];

const round = (ms) => Math.round(ms * 10) / 10;

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${url} -> ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
};

export const main = async ({ log = console.log } = {}) => {
  const base = (process.env.BENCH_URL ?? 'http://localhost:5000').replace(/\/+$/, '');
  const email = process.env.BENCH_EMAIL ?? TEAM[0].email;
  const password = process.env.BENCH_PASSWORD ?? SEED_PASSWORD;
  const runs = Number(process.env.BENCH_RUNS ?? 200);
  const warmup = Number(process.env.BENCH_WARMUP ?? 10);

  const { token } = await request(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const auth = { Authorization: `Bearer ${token}` };
  const { orgs } = await request(`${base}/api/v1/orgs`, { headers: auth });
  // The seeded team org, not the account's Personal one.
  const org = orgs.find((candidate) => !candidate.isPersonal) ?? orgs[0];
  if (!org) throw new Error(`${email} belongs to no organization`);

  const headers = { ...auth, 'X-Org-Id': org._id };
  const statsUrl = `${base}/api/v1/stats`;

  const sample = await request(statsUrl, { headers });
  const totalJobs = Object.values(sample.countsByStatus).reduce((sum, n) => sum + n, 0);

  // Warm up so connection setup and first-query planning are not measured.
  for (let i = 0; i < warmup; i += 1) await request(statsUrl, { headers });

  const timings = [];
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    await request(statsUrl, { headers });
    timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);

  const p95 = percentile(timings, 0.95);
  const passed = p95 < TARGET_P95_MS;

  log(
    [
      `[bench] GET /api/v1/stats   ${base}`,
      `[bench] org "${org.name}" with ${totalJobs} jobs, ${runs} requests after ${warmup} warmup`,
      `[bench]   min   ${round(timings[0])} ms`,
      `[bench]   p50   ${round(percentile(timings, 0.5))} ms`,
      `[bench]   p95   ${round(p95)} ms`,
      `[bench]   p99   ${round(percentile(timings, 0.99))} ms`,
      `[bench]   max   ${round(timings.at(-1))} ms`,
      `[bench] target p95 < ${TARGET_P95_MS} ms -> ${passed ? 'PASS' : 'FAIL'}`,
    ].join('\n')
  );

  return { p95, passed, runs, totalJobs };
};

main()
  .then(({ passed }) => process.exit(passed ? 0 : 1))
  .catch((error) => {
    console.error(`[bench] ${error.message}`);
    process.exit(1);
  });
