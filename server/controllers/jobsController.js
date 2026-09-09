import { StatusCodes } from 'http-status-codes';
import Job from '../models/Job.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import checkPermissions from '../utils/checkPermissions.js';

/**
 * Fields a client is allowed to set. createdBy is deliberately absent: it is
 * always taken from the verified JWT, never from the request body.
 */
const EDITABLE_FIELDS = ['company', 'position', 'jobLocation', 'status', 'jobType'];

/**
 * Copy only the editable fields the client actually sent.
 */
const pickEditableFields = (body) =>
  Object.fromEntries(
    EDITABLE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [
      field,
      body[field],
    ])
  );

/**
 * Load a job by id and confirm the current user owns it.
 * 404 if it does not exist, 403 if it belongs to someone else.
 */
const findOwnedJob = async (jobId, requestUser) => {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  checkPermissions(requestUser, job.createdBy);
  return job;
};

/**
 * Sort options accepted by GET /jobs, mapped to mongoose sort strings.
 * Each falls back to _id so that documents with equal sort keys keep a stable
 * order between pages; without it, paginated results can repeat or skip rows.
 */
const SORT_OPTIONS = {
  latest: '-createdAt -_id',
  oldest: 'createdAt _id',
  'a-z': 'position _id',
  'z-a': '-position -_id',
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Escape regex metacharacters so a search term is matched literally.
 * Without this, input like "(a+)+$" is compiled as a pattern and can be used
 * to hang the server, and characters such as "." would match anything.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Read a positive integer from a query param, falling back when it is missing,
 * not a number, or out of range.
 */
const toPositiveInt = (value, fallback, max = Infinity) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

/**
 * GET /api/v1/jobs
 * query: status, jobType, sort, search, page, limit
 * 200 -> { jobs, totalJobs, numOfPages }
 *
 * Always scoped to the authenticated user, so one user can never read another
 * user's jobs regardless of the filters supplied.
 */
export const getAllJobs = async (req, res) => {
  const { status, jobType, sort, search } = req.query;

  const queryObject = { createdBy: req.user.userId };

  // 'all' (and a missing param) means no filtering on that field.
  if (status && status !== 'all') queryObject.status = status;
  if (jobType && jobType !== 'all') queryObject.jobType = jobType;
  if (search) {
    queryObject.position = { $regex: escapeRegex(search), $options: 'i' };
  }

  const sortKey = SORT_OPTIONS[sort] ?? SORT_OPTIONS.latest;

  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const [jobs, totalJobs] = await Promise.all([
    Job.find(queryObject).sort(sortKey).skip(skip).limit(limit),
    Job.countDocuments(queryObject),
  ]);

  const numOfPages = Math.ceil(totalJobs / limit);

  res.status(StatusCodes.OK).json({ jobs, totalJobs, numOfPages });
};

/**
 * POST /api/v1/jobs
 * body: { company, position, jobLocation, status?, jobType? }
 * 201 -> { job }
 * 400 -> missing required fields
 */
export const createJob = async (req, res) => {
  const { company, position, jobLocation } = req.body;

  if (!company || !position || !jobLocation) {
    throw new BadRequestError('Please provide company, position and job location');
  }

  const job = await Job.create({
    ...pickEditableFields(req.body),
    createdBy: req.user.userId,
  });

  res.status(StatusCodes.CREATED).json({ job });
};

/**
 * PATCH /api/v1/jobs/:id
 * Partial update: only the fields present in the body are changed.
 * 200 -> { job } | 400 empty body | 403 not owner | 404 not found
 */
export const updateJob = async (req, res) => {
  const { id: jobId } = req.params;

  const updates = pickEditableFields(req.body);
  if (Object.keys(updates).length === 0) {
    throw new BadRequestError('Please provide at least one field to update');
  }

  await findOwnedJob(jobId, req.user);

  const job = await Job.findByIdAndUpdate(jobId, updates, {
    new: true,
    runValidators: true,
  });

  res.status(StatusCodes.OK).json({ job });
};

/**
 * DELETE /api/v1/jobs/:id
 * 200 -> { msg } | 403 not owner | 404 not found
 */
export const deleteJob = async (req, res) => {
  const { id: jobId } = req.params;

  const job = await findOwnedJob(jobId, req.user);
  await job.deleteOne();

  res.status(StatusCodes.OK).json({ msg: 'Job removed' });
};
