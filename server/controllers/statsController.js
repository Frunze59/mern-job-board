import { StatusCodes } from 'http-status-codes';
// import mongoose from 'mongoose';
// import Job from '../models/Job.js';

/**
 * GET /api/v1/stats   (active org, no query params)
 * 200 -> {
 *   countsByStatus:       { pending, interview, declined },
 *   applicationsPerMonth: [{ month: 'YYYY-MM', count }]   last 6 months, oldest first, zeros filled
 *   topCompanies:         [{ company, count }]            max 3, count desc then company asc
 * }
 *
 * One aggregation pipeline, one round trip:
 *   $match  { organization }
 *   $facet  {
 *     countsByStatus: [ $group by status ],
 *     perMonth:       [ $match createdAt >= first day of (now - 5 months),
 *                       $group by $dateToString '%Y-%m', $sort month asc ],
 *     topCompanies:   [ $group by company, $sort { count: -1, _id: 1 }, $limit 3 ]
 *   }
 *   $project to the final shape.
 *
 * The only work done in JS afterwards is shaping, not counting: turning the
 * facet arrays into the object / zero-filled 6-month list the brief asks for.
 *
 * Index: { organization: 1, createdAt: -1 } on Job (added in Job.js) so the
 * $match uses an index and the month branch can range-scan.
 *
 * TODO: build the pipeline; keep it as an exported `buildStatsPipeline(orgId, now)`
 *       so tests can assert against a fixed `now`.
 */
export const getStats = async (req, res) => {
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'getStats not implemented' });
};
