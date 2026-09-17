/**
 * bench-stats: measure GET /api/v1/stats latency to prove the p95 < 200ms
 * requirement on the seeded dataset.
 *
 * Run with:  BENCH_URL=http://localhost:5000 BENCH_EMAIL=alice@acme.test \
 *            BENCH_PASSWORD=Password123 npm run bench:stats
 *
 * Logs in, then calls /stats 200 times and prints min / p50 / p95 / max in ms.
 * Paste the output into the PR as the timing evidence the brief asks for.
 *
 * TODO: implement with fetch; sort the timings and index at Math.ceil(0.95 * n) - 1.
 */
console.error('bench-stats not implemented');
process.exit(1);
