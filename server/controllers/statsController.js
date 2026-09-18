import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import Job from '../models/Job.js';

/** The three statuses always appear, even at zero. */
const STATUSES = ['pending', 'interview', 'declined'];

export const MONTHS_REPORTED = 6;
const TOP_COMPANIES_LIMIT = 3;

/**
 * Months are bucketed in UTC, matching $dateToString's default, so the server's
 * local timezone cannot shift a job from one month to another.
 */
const startOfUtcMonth = (date, monthsBack = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1));

const monthKey = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

/** The six month keys to report, oldest first, ending with the current month. */
export const monthWindow = (now) =>
  Array.from({ length: MONTHS_REPORTED }, (_, index) =>
    monthKey(startOfUtcMonth(now, MONTHS_REPORTED - 1 - index))
  );

/**
 * One pipeline, one round trip. $facet runs the three branches in parallel over
 * the single $match, so the database does all the counting; nothing is counted
 * in JavaScript.
 *
 * Exported so tests can run it against a fixed `now`.
 */
export const buildStatsPipeline = (orgId, now = new Date()) => [
  // Uses the { organization: 1, createdAt: -1 } index on Job. aggregate() does
  // not cast strings, so the id has to be a real ObjectId here.
  { $match: { organization: new mongoose.Types.ObjectId(String(orgId)) } },
  {
    $facet: {
      countsByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      perMonth: [
        { $match: { createdAt: { $gte: startOfUtcMonth(now, MONTHS_REPORTED - 1) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ],
      topCompanies: [
        { $group: { _id: '$company', count: { $sum: 1 } } },
        // Most first; ties broken by company name so the order is stable.
        { $sort: { count: -1, _id: 1 } },
        { $limit: TOP_COMPANIES_LIMIT },
      ],
    },
  },
  {
    $project: {
      countsByStatus: 1,
      perMonth: 1,
      topCompanies: {
        $map: {
          input: '$topCompanies',
          as: 'company',
          in: { company: '$$company._id', count: '$$company.count' },
        },
      },
    },
  },
];

/**
 * Turn the facet output into the response shape.
 *
 * This is shaping, not counting: it spreads the status rows into an object and
 * lays the month rows onto a fixed six-month list so empty months read 0.
 * Doing that in the pipeline would need a generated date range for no gain.
 */
export const shapeStats = (facetResult, now) => {
  const { countsByStatus = [], perMonth = [], topCompanies = [] } = facetResult ?? {};

  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const row of countsByStatus) {
    if (row._id in counts) counts[row._id] = row.count;
  }

  const countByMonth = new Map(perMonth.map((row) => [row._id, row.count]));

  return {
    countsByStatus: counts,
    applicationsPerMonth: monthWindow(now).map((month) => ({
      month,
      count: countByMonth.get(month) ?? 0,
    })),
    topCompanies,
  };
};

/**
 * GET /api/v1/stats   (any role, active org, no query params)
 * 200 -> { countsByStatus, applicationsPerMonth, topCompanies }
 */
export const getStats = async (req, res) => {
  const now = new Date();
  const [result] = await Job.aggregate(buildStatsPipeline(req.org.orgId, now));

  res.status(StatusCodes.OK).json(shapeStats(result, now));
};
