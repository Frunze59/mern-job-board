/**
 * seed-team: one organization, three members, 500 jobs.
 *
 *   SEED_URL=mongodb://127.0.0.1:27017/jobboard-dev npm run seed
 *   SEED_URL=... SEED_FORCE=1 npm run seed     (wipe first)
 *
 * Existing data (the brief's second open question)
 * ------------------------------------------------
 * It REFUSES to run against a database that already has users, unless
 * SEED_FORCE=1 is set, in which case it wipes the five collections first.
 * Appending was rejected because the dataset would no longer be the 500 jobs
 * the performance target is defined against; wiping silently was rejected
 * because that is how a typo in a URL destroys real data. It also refuses when
 * SEED_URL matches MONGO_URL from .env, so the app's own database cannot be
 * seeded by accident.
 *
 * The data is generated from a fixed seed, so every run produces the same
 * dataset and benchmark numbers are comparable between runs.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import Invitation from '../models/Invitation.js';
import Job from '../models/Job.js';

export const TOTAL_JOBS = 500;
export const SEED_PASSWORD = 'Password123';
export const ORG_NAME = 'Acme Recruiting';

export const TEAM = [
  { name: 'Alice Owner', email: 'alice@acme.test', role: 'owner', share: 0.5 },
  { name: 'Bob Recruiter', email: 'bob@acme.test', role: 'recruiter', share: 0.4 },
  { name: 'Cara Viewer', email: 'cara@acme.test', role: 'viewer', share: 0.1 },
];

const STATUSES = ['pending', 'interview', 'declined'];
const JOB_TYPES = ['full-time', 'part-time', 'remote'];
const LOCATIONS = ['Riga', 'Tallinn', 'Vilnius', 'Helsinki', 'Oslo', 'Tartu', 'Remote'];
const TITLES = [
  'Backend Developer', 'Frontend Developer', 'Fullstack Developer', 'QA Engineer',
  'DevOps Engineer', 'Data Engineer', 'Mobile Developer', 'Platform Engineer',
  'Site Reliability Engineer', 'Solutions Architect', 'Engineering Manager', 'Product Engineer',
];
const COMPANY_PREFIX = [
  'Acme', 'Beta', 'Cobalt', 'Delta', 'Ember', 'Fable', 'Granite', 'Helix', 'Ionic', 'Juniper',
  'Kestrel', 'Lumen', 'Meridian', 'Nimbus', 'Onyx', 'Pallas', 'Quartz', 'Rivet', 'Solstice', 'Tundra',
];
const COMPANY_SUFFIX = ['Labs', 'Systems'];

/** ~40 distinct companies, so topCompanies has something to rank. */
const COMPANIES = COMPANY_PREFIX.flatMap((prefix) =>
  COMPANY_SUFFIX.map((suffix) => `${prefix} ${suffix}`)
);

/** Small deterministic PRNG, so the dataset is identical on every run. */
const makeRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (random, list) => list[Math.floor(random() * list.length)];

/**
 * A date within the last 12 months, weighted towards recent ones: squaring a
 * uniform value bunches results near zero, which here means near today.
 */
const recentDate = (random, now) => {
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - random() ** 2 * yearMs);
};

/** Build the 500 job documents. Exported so tests can check the spread. */
export const buildJobs = ({ authors, organizationId, now = new Date(), seed = 20260917 }) => {
  const random = makeRandom(seed);

  // Weighted author list: 50 / 40 / 10 by the shares above.
  const weighted = authors.flatMap((author) =>
    Array.from({ length: Math.round(author.share * 100) }, () => author.userId)
  );

  return Array.from({ length: TOTAL_JOBS }, (_, index) => {
    const createdAt = recentDate(random, now);
    return {
      company: pick(random, COMPANIES),
      position: pick(random, TITLES),
      jobLocation: pick(random, LOCATIONS),
      // Cycle the enums so all three values appear in roughly equal numbers.
      status: STATUSES[index % STATUSES.length],
      jobType: JOB_TYPES[Math.floor(index / 3) % JOB_TYPES.length],
      createdBy: pick(random, weighted),
      organization: organizationId,
      createdAt,
      updatedAt: createdAt,
    };
  });
};

const COLLECTIONS = [User, Organization, Membership, Invitation, Job];

/**
 * Seed the currently connected database.
 * Returns a summary; throws if the database is not empty and force is false.
 */
export const runSeed = async ({ force = false, now = new Date(), log = console.log } = {}) => {
  await Promise.all(COLLECTIONS.map((model) => model.init()));

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    if (!force) {
      throw new Error(
        `Refusing to seed: this database already has ${existingUsers} user(s). ` +
          'Point SEED_URL at an empty database, or set SEED_FORCE=1 to wipe it first.'
      );
    }
    log('[seed] SEED_FORCE=1, wiping existing data');
    await Promise.all(COLLECTIONS.map((model) => model.deleteMany({})));
  }

  const org = await Organization.createWithUniqueSlug(ORG_NAME);

  const authors = [];
  for (const member of TEAM) {
    // Through the model, so the password is hashed exactly as registration does.
    const user = await User.create({
      name: member.name,
      email: member.email,
      password: SEED_PASSWORD,
    });
    // Every account has a Personal org, matching what registration creates.
    await Organization.ensurePersonalFor(user._id);
    await Membership.create({ user: user._id, organization: org._id, role: member.role });
    authors.push({ userId: user._id, share: member.share });
  }

  const jobs = buildJobs({ authors, organizationId: org._id, now });
  await Job.insertMany(jobs, { ordered: false });

  const summary = {
    org: org.name,
    orgId: String(org._id),
    members: TEAM.length,
    jobs: await Job.countDocuments({ organization: org._id }),
    companies: (await Job.distinct('company', { organization: org._id })).length,
  };

  log(
    [
      `[seed] organization: ${summary.org} (${summary.orgId})`,
      `[seed] members:      ${summary.members} (${TEAM.map((m) => `${m.email} = ${m.role}`).join(', ')})`,
      `[seed] password:     ${SEED_PASSWORD}`,
      `[seed] jobs:         ${summary.jobs} across ${summary.companies} companies, last 12 months`,
    ].join('\n')
  );

  return summary;
};

export const main = async ({ log = console.log } = {}) => {
  const seedUrl = process.env.SEED_URL;
  if (!seedUrl) {
    throw new Error('SEED_URL is not set. Point it at a development database.');
  }
  if (process.env.MONGO_URL && seedUrl === process.env.MONGO_URL) {
    throw new Error(
      'Refusing to seed: SEED_URL is the same as MONGO_URL. Use a separate development database.'
    );
  }

  await mongoose.connect(seedUrl);
  try {
    await runSeed({ force: process.env.SEED_FORCE === '1', log });
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  dotenv.config({ quiet: true });
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`[seed] ${error.message}`);
      process.exit(1);
    });
}
