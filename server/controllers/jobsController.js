import { StatusCodes } from 'http-status-codes';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

/**
 * Fields a client is allowed to set. createdBy and organization are
 * deliberately absent: createdBy comes from the verified JWT and organization
 * from the active org, never from the request body. That also means a PATCH
 * cannot move a job into another organization.
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
 * Every lookup below is scoped to the active org. A job in any other org is
 * simply not found (404): from where the caller stands it does not exist.
 * v1's createdBy ownership check is gone; the role check happens in
 * requireRole before these handlers run.
 */
const orgJobFilter = (req, jobId) => ({ _id: jobId, organization: req.org.orgId });

const notFound = (jobId) => new NotFoundError(`No job with id ${jobId}`);

/**
 * Add `createdByName` to each job with ONE extra query for all authors.
 *
 * Chosen over Mongoose populate: populate replaces createdBy with null when
 * the author no longer exists, which loses the id. Here the id always stays
 * and only the name can be null.
 */
const withCreatedByName = async (jobs) => {
  const plain = jobs.map((job) => (typeof job.toObject === 'function' ? job.toObject() : job));
  const authorIds = [...new Set(plain.map((job) => String(job.createdBy)))];
  const authors = await User.find({ _id: { $in: authorIds } }, { name: 1 }).lean();
  const nameById = new Map(authors.map((user) => [String(user._id), user.name]));

  return plain.map((job) => ({
    ...job,
    createdByName: nameById.get(String(job.createdBy)) ?? null,
  }));
};

const withCreatedByNameOne = async (job) => (await withCreatedByName([job]))[0];

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
 * Always scoped to the active organization, so no filter can widen the result
 * to another org's jobs. Each job carries createdByName.
 */
export const getAllJobs = async (req, res) => {
  const { status, jobType, sort, search } = req.query;

  const queryObject = { organization: req.org.orgId };

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

  const [pageOfJobs, totalJobs] = await Promise.all([
    Job.find(queryObject).sort(sortKey).skip(skip).limit(limit).lean(),
    Job.countDocuments(queryObject),
  ]);

  const jobs = await withCreatedByName(pageOfJobs);
  const numOfPages = Math.ceil(totalJobs / limit);

  res.status(StatusCodes.OK).json({ jobs, totalJobs, numOfPages });
};

/**
 * GET /api/v1/jobs/:id   (any role)
 * 200 -> { job } | 404 not in the active org
 * Used by the Edit Job page to prefill its form on a fresh page load.
 */
export const getJob = async (req, res) => {
  const job = await Job.findOne(orgJobFilter(req, req.params.id)).lean();
  if (!job) throw notFound(req.params.id);
  res.status(StatusCodes.OK).json({ job: await withCreatedByNameOne(job) });
};

/**
 * POST /api/v1/jobs   (owner, recruiter)
 * body: { company, position, jobLocation, status?, jobType? }
 * 201 -> { job } | 400 missing required fields | 403 viewer
 */
export const createJob = async (req, res) => {
  const { company, position, jobLocation } = req.body;

  if (!company || !position || !jobLocation) {
    throw new BadRequestError('Please provide company, position and job location');
  }

  const job = await Job.create({
    ...pickEditableFields(req.body),
    createdBy: req.user.userId,
    organization: req.org.orgId,
  });

  res.status(StatusCodes.CREATED).json({ job: await withCreatedByNameOne(job) });
};

/**
 * PATCH /api/v1/jobs/:id   (owner, recruiter)
 * Partial update: only the fields present in the body are changed.
 * Any writer in the org may edit any job in it, not just their own.
 * 200 -> { job } | 400 empty body | 403 viewer | 404 not in the active org
 */
export const updateJob = async (req, res) => {
  const { id: jobId } = req.params;

  const updates = pickEditableFields(req.body);
  if (Object.keys(updates).length === 0) {
    throw new BadRequestError('Please provide at least one field to update');
  }

  // Scope and update in one query, so the job cannot change org between a
  // separate "check" and "write".
  const job = await Job.findOneAndUpdate(orgJobFilter(req, jobId), updates, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();
  if (!job) throw notFound(jobId);

  res.status(StatusCodes.OK).json({ job: await withCreatedByNameOne(job) });
};

/**
 * DELETE /api/v1/jobs/:id   (owner, recruiter)
 * 200 -> { msg } | 403 viewer | 404 not in the active org
 */
export const deleteJob = async (req, res) => {
  const { id: jobId } = req.params;

  const { deletedCount } = await Job.deleteOne(orgJobFilter(req, jobId));
  if (deletedCount === 0) throw notFound(jobId);

  res.status(StatusCodes.OK).json({ msg: 'Job removed' });
};
