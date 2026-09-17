/**
 * 001-orgs: give every pre-v2 user a Personal organization and move their
 * jobs into it.
 *
 * Run with:  npm run migrate      (also runs on every Render deploy, before
 *                                   the server starts; see render.yaml)
 *
 * Idempotent by construction, not by convention:
 *  - users who already have any Membership are skipped
 *  - Organization.personalFor has a unique partial index, so even a crash
 *    between "create org" and "create membership" cannot produce a second
 *    Personal org on the next run; we catch the duplicate and reuse the org
 *  - jobs are matched with { organization: { $exists: false } }, so already
 *    moved jobs are never touched again
 *
 * Each user is processed independently, so a failure on one user leaves
 * every other user fully migrated and the failed one untouched for the rerun.
 *
 * TODO:
 *  1. dotenv + connectDB(process.env.MONGO_URL)
 *  2. users = User.find({})
 *  3. for each user:
 *       hasMembership -> skipped++ ; continue
 *       org = find-or-create Personal org (personalFor: user._id)
 *       Membership.create({ user, organization: org, role: 'owner' })
 *       r = Job.updateMany({ createdBy: user._id, organization: { $exists: false } },
 *                          { $set: { organization: org._id } })
 *       jobsMigrated += r.modifiedCount
 *  4. print summary: users processed, orgs created, jobs migrated, skipped
 *  5. export `runMigration()` and only call it when executed directly, so
 *     the test suite can import and run it twice against memory-server
 */
export const runMigration = async () => {
  throw new Error('001-orgs migration not implemented');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  // TODO: connect, runMigration(), print summary, exit 0 (exit 1 on error)
}
