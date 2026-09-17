import mongoose from 'mongoose';
import Membership from './Membership.js';

export const PERSONAL_ORG_NAME = 'Personal';

const MAX_SLUG_ATTEMPTS = 20;

/**
 * Organization
 *
 *  - name         String, required, 3-80 chars, trimmed
 *  - slug         String, required, unique, generated from name when created
 *  - personalFor  ObjectId ref User. Set ONLY on the automatic "Personal" org
 *                 made at registration. A unique index on it does two jobs:
 *                 "find user X's Personal org" is a single indexed lookup, and
 *                 the database refuses a second Personal org for the same user,
 *                 which is what makes the migration safe to run twice.
 *  - timestamps
 */
const OrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide an organization name'],
      minlength: [3, 'Organization name must be at least 3 characters'],
      maxlength: [80, 'Organization name cannot be longer than 80 characters'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    personalFor: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Unique only among Personal orgs. A plain unique index would treat every
// shared org (which has no personalFor) as a duplicate of the others. A
// partial index filtered on the value's type skips them, and unlike a sparse
// index it also skips a stray explicit `null`.
OrganizationSchema.index(
  { personalFor: 1 },
  { unique: true, partialFilterExpression: { personalFor: { $type: 'objectId' } } }
);

const isDuplicateKey = (error, field) =>
  error?.code === 11000 && Boolean(error.keyPattern?.[field]);

/**
 * Turn a display name into a URL-safe slug.
 *   "Acme Recruiting!"  -> "acme-recruiting"
 *   "Ångström & Co"     -> "angstrom-co"
 * Never returns an empty string, so a name made only of symbols still works.
 */
OrganizationSchema.statics.slugify = function slugify(name) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'org';
};

/**
 * Create an organization whose slug is unique, appending -2, -3 ... as needed.
 *
 * The first attempt starts past the highest suffix already taken, so creating
 * the tenth "Acme" is one insert rather than ten. The unique index remains the
 * real guarantee: if two requests race for the same slug, the loser catches
 * the duplicate-key error and tries the next number.
 */
OrganizationSchema.statics.createWithUniqueSlug = async function createWithUniqueSlug(
  name,
  extra = {}
) {
  const base = this.slugify(name);
  const taken = await this.find(
    { slug: { $regex: `^${base}(-\\d+)?$` } },
    { slug: 1, _id: 0 }
  ).lean();

  // "acme" counts as 1, "acme-7" as 7. Start one past the highest.
  let next = 1;
  for (const { slug } of taken) {
    const n = slug === base ? 1 : Number(slug.slice(base.length + 1));
    next = Math.max(next, n + 1);
  }

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const n = next + attempt;
    const slug = n === 1 ? base : `${base}-${n}`;
    try {
      return await this.create({ ...extra, name, slug });
    } catch (error) {
      if (!isDuplicateKey(error, 'slug')) throw error;
    }
  }
  throw new Error(`Could not find a free slug for "${name}"`);
};

/**
 * Find or create the user's Personal organization.
 * Returns { org, created }. Safe to call repeatedly and concurrently: if two
 * callers race, the unique index rejects the second insert and it returns the
 * org the first one made.
 */
OrganizationSchema.statics.findOrCreatePersonal = async function findOrCreatePersonal(
  userId
) {
  const existing = await this.findOne({ personalFor: userId });
  if (existing) return { org: existing, created: false };

  try {
    const org = await this.create({
      name: PERSONAL_ORG_NAME,
      // Tied to the user id, so it can never collide with a shared org's slug.
      slug: `personal-${userId}`,
      personalFor: userId,
    });
    return { org, created: true };
  } catch (error) {
    if (!isDuplicateKey(error, 'personalFor') && !isDuplicateKey(error, 'slug')) {
      throw error;
    }
    const org = await this.findOne({ personalFor: userId });
    return { org, created: false };
  }
};

/**
 * Guarantee that a user has a Personal org AND an owner membership in it.
 * Returns { org, orgCreated, membershipCreated }.
 *
 * Used by registration and by the 001-orgs migration. It also repairs a
 * half-finished state: if a crash left the org without its membership, the
 * next call adds the membership rather than creating a second org.
 *
 * $setOnInsert means an existing membership is never modified.
 */
OrganizationSchema.statics.ensurePersonalFor = async function ensurePersonalFor(userId) {
  const { org, created: orgCreated } = await this.findOrCreatePersonal(userId);

  let membershipCreated = false;
  try {
    const result = await Membership.updateOne(
      { user: userId, organization: org._id },
      { $setOnInsert: { role: 'owner' } },
      { upsert: true }
    );
    membershipCreated = result.upsertedCount === 1;
  } catch (error) {
    // Two concurrent upserts can both miss and both insert; the unique index
    // rejects the loser, which means the membership exists. That is success.
    if (error?.code !== 11000) throw error;
  }

  return { org, orgCreated, membershipCreated };
};

export default mongoose.model('Organization', OrganizationSchema);
