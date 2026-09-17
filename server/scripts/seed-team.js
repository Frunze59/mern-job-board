/**
 * seed-team: one organization, three members, 500 jobs.
 *
 * Run with:  SEED_URL=mongodb://... npm run seed
 *
 * Refuses to run against a database that already has users, unless
 * SEED_FORCE=1 is set, in which case it wipes users, orgs, memberships,
 * invitations and jobs first. Also refuses if SEED_URL equals MONGO_URL from
 * .env, so a copy-paste slip cannot point it at production. See README.
 *
 * Dataset shape (so /stats has something to show):
 *  - org "Acme Recruiting", members alice (owner), bob (recruiter), cara (viewer)
 *    all with password  Password123
 *  - 500 jobs, createdBy spread ~50/40/10 across alice/bob/cara
 *  - createdAt spread across the last 12 months (weighted towards recent)
 *  - status and jobType drawn from the three values each, ~evenly
 *  - ~40 distinct companies so topCompanies is meaningful
 *
 * TODO: implement; use insertMany for the jobs (one round trip); print counts.
 */
console.error('seed-team not implemented');
process.exit(1);
