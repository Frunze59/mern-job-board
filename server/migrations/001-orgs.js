/**
 * 001-orgs: give every pre-v2 user a Personal organization and move their
 * jobs into it.
 *
 *   npm run migrate                 apply
 *   npm run migrate:dry-run         report what would change, write nothing
 *   MIGRATE_DRY_RUN=1 npm run migrate    same, via the environment
 *
 * Runs on every Render deploy before the server starts (see render.yaml).
 * With nothing to do it finishes quickly and exits 0, so startup continues.
 *
 * Which users are touched
 * -----------------------
 * The brief says: every user who has no Membership yet. Taken literally, that
 * rule loses data. If a previous run created a user's org and membership and
 * then crashed before moving the jobs, the rerun would skip that user (they
 * now have a membership) and the jobs would stay without an org, invisible
 * forever. So a user is skipped only when they have a membership AND no jobs
 * left to move. Users finished off that way are reported as "resumed".
 *
 * Why it is safe to run twice
 * ---------------------------
 * - Organization.personalFor has a unique partial index: a second Personal org
 *   for the same user is refused by the database itself.
 * - Membership has a unique (user, organization) index.
 * - Only jobs with no organization are updated, so a moved job is never
 *   touched again.
 * All three indexes are built before the first write (see ensureIndexes).
 *
 * Partial failure
 * ---------------
 * Each user is handled on their own. An error for one user is recorded and the
 * run carries on; every other user ends up fully migrated, and the failed one
 * is picked up again next run. Any failure makes the CLI exit 1, which stops
 * the deploy: a server that refuses to start is better than one serving a
 * half-migrated database.
 *
 * Why this can run while the OLD version is still serving
 * -------------------------------------------------------
 * The migration only adds data: new orgs, new memberships, and an
 * `organization` field on jobs. It changes nothing v1 reads, and v1 still
 * finds jobs by `createdBy`. So the previous deploy keeps serving correctly
 * while the new one migrates, and there is no downtime window.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../db/connect.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Job from '../models/Job.js';

const NAME = '001-orgs';

/** Matches jobs whose organization field is missing or null. */
const UNASSIGNED = { organization: null };

const ensureIndexes = () =>
  Promise.all([Organization.init(), Membership.init(), Job.init(), User.init()]);

/**
 * Apply (or, with dryRun, simulate) the migration.
 * Returns the summary; never throws for a single user's failure.
 */
export const runMigration = async ({ dryRun = false, log = console.log } = {}) => {
  const summary = {
    usersProcessed: 0,
    orgsCreated: 0,
    jobsMigrated: 0,
    usersSkipped: 0,
    usersResumed: 0,
    usersFailed: 0,
    jobsWithoutUser: 0,
    failures: [],
    dryRun,
  };

  if (!dryRun) await ensureIndexes();

  const users = User.find({}, { _id: 1, email: 1 }).sort({ _id: 1 }).lean().cursor();

  for await (const user of users) {
    summary.usersProcessed += 1;
    try {
      const [hasMembership, pendingJobs] = await Promise.all([
        Membership.exists({ user: user._id }),
        Job.countDocuments({ createdBy: user._id, ...UNASSIGNED }),
      ]);

      if (hasMembership && pendingJobs === 0) {
        summary.usersSkipped += 1;
        continue;
      }
      if (hasMembership) summary.usersResumed += 1;

      if (dryRun) {
        const personal = await Organization.exists({ personalFor: user._id });
        if (!personal) summary.orgsCreated += 1;
        summary.jobsMigrated += pendingJobs;
        continue;
      }

      const { org, orgCreated } = await Organization.ensurePersonalFor(user._id);
      if (orgCreated) summary.orgsCreated += 1;

      const { modifiedCount } = await Job.updateMany(
        { createdBy: user._id, ...UNASSIGNED },
        { $set: { organization: org._id } }
      );
      summary.jobsMigrated += modifiedCount;
    } catch (error) {
      summary.usersFailed += 1;
      summary.failures.push({ userId: String(user._id), message: error.message });
      log(`[migrate ${NAME}] user ${user._id} failed: ${error.message}`);
    }
  }

  // Jobs whose author no longer exists have nobody to attach them to.
  // They are reported, not guessed at.
  const authorIds = await User.distinct('_id');
  summary.jobsWithoutUser = await Job.countDocuments({
    ...UNASSIGNED,
    createdBy: { $nin: authorIds },
  });

  log(formatSummary(summary));
  return summary;
};

/** Human-readable summary. The first four lines are the ones the brief asks for. */
export const formatSummary = (s) => {
  const prefix = `[migrate ${NAME}]`;
  const rows = [
    ['users processed', s.usersProcessed],
    ['orgs created', s.orgsCreated],
    ['jobs migrated', s.jobsMigrated],
    ['users already migrated (skipped)', s.usersSkipped],
    ['users resumed after an interrupted run', s.usersResumed],
    ['users failed', s.usersFailed],
  ];
  const width = Math.max(...rows.map(([label]) => label.length)) + 1;
  const lines = [
    `${prefix} ${s.dryRun ? 'DRY RUN, nothing written' : 'done'}`,
    ...rows.map(([label, value]) => `${prefix}   ${`${label}:`.padEnd(width)} ${value}`),
  ];
  if (s.jobsWithoutUser > 0) {
    lines.push(
      `${prefix}   WARNING: ${s.jobsWithoutUser} job(s) have no organization and their author no longer exists`
    );
  }
  return lines.join('\n');
};

/** CLI entry point. Exported so the exit-code logic can be tested. */
export const main = async ({ argv = process.argv, url, log = console.log } = {}) => {
  // Also accept MIGRATE_DRY_RUN=1: a flag can be swallowed by an npm wrapper
  // that forgets `--`, an environment variable cannot.
  const dryRun = argv.includes('--dry-run') || process.env.MIGRATE_DRY_RUN === '1';
  await connectDB(url ?? process.env.MONGO_URL);
  try {
    const summary = await runMigration({ dryRun, log });
    return summary.usersFailed > 0 ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
};

// Run only when executed directly, not when imported by the tests.
// Compare real paths: the project folder name contains a space, which appears
// as %20 in import.meta.url but as a literal space in argv.
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  // Loaded here rather than in main() so importing this file never pulls
  // .env into the test process.
  dotenv.config({ quiet: true });
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`[migrate ${NAME}] aborted: ${error.message}`);
      process.exit(1);
    });
}
