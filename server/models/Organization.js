import mongoose from 'mongoose';

/**
 * Organization
 *
 *  - name         String, required, 3-80 chars, trimmed
 *  - slug         String, unique, generated from name when created
 *  - personalFor  ObjectId ref User, unique + sparse. Set ONLY on the automatic
 *                 "Personal" org made at registration. Two things fall out of
 *                 this one field: "find user X's Personal org" is a single
 *                 indexed lookup, and the database itself refuses a second
 *                 Personal org for the same user, which is what makes the
 *                 migration safe to run twice.
 *  - timestamps
 *
 * TODO:
 *  1. schema fields above
 *  2. static  Organization.slugify(name) -> lowercase, dashes, strip symbols
 *  3. static  Organization.createWithUniqueSlug(name, extra) -> tries the slug,
 *     appends -2, -3 ... on a duplicate-key error
 *  4. Personal orgs use slug `personal-<userId>` so they never collide
 */
const OrganizationSchema = new mongoose.Schema(
  {
    // TODO
  },
  { timestamps: true }
);

export default mongoose.model('Organization', OrganizationSchema);
