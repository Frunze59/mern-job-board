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
 * GET /api/v1/jobs
 * query: status, jobType, sort, search, page, limit
 * 200 -> { jobs, totalJobs, numOfPages }
 */
export const getAllJobs = async (req, res) => {
  // TODO (step 7):
  //  1. queryObject = { createdBy: req.user.userId }
  //  2. status !== 'all'  -> queryObject.status = status
  //     jobType !== 'all' -> queryObject.jobType = jobType
  //     search            -> queryObject.position = { $regex: search, $options: 'i' }
  //  3. sort: latest (-createdAt, default) | oldest (createdAt) | a-z (position) | z-a (-position)
  //  4. pagination: page (default 1), limit (default 10), skip = (page - 1) * limit
  //  5. totalJobs = Job.countDocuments(queryObject); numOfPages = Math.ceil(totalJobs / limit)
  //  6. respond 200 with { jobs, totalJobs, numOfPages }
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'getAllJobs not implemented' });
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
