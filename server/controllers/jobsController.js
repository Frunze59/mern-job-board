import { StatusCodes } from 'http-status-codes';
// import Job from '../models/Job.js';
// import { BadRequestError, NotFoundError } from '../errors/index.js';
// import checkPermissions from '../utils/checkPermissions.js';

/**
 * GET /api/v1/jobs
 * query: status, jobType, sort, search, page, limit
 * 200 -> { jobs, totalJobs, numOfPages }
 */
export const getAllJobs = async (req, res) => {
  // TODO:
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
 */
export const createJob = async (req, res) => {
  // TODO:
  //  1. validate company, position, jobLocation (BadRequestError)
  //  2. req.body.createdBy = req.user.userId   (never trust the client for this)
  //  3. job = Job.create(req.body)
  //  4. respond 201 with { job }
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'createJob not implemented' });
};

/**
 * PATCH /api/v1/jobs/:id
 * 200 -> { job } | 404 not found | 403 not owner
 */
export const updateJob = async (req, res) => {
  // TODO:
  //  1. find job by req.params.id -> NotFoundError
  //  2. checkPermissions(req.user, job.createdBy) -> ForbiddenError
  //  3. Job.findOneAndUpdate({ _id }, req.body, { new: true, runValidators: true })
  //  4. respond 200 with { job }
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'updateJob not implemented' });
};

/**
 * DELETE /api/v1/jobs/:id
 * 200 -> { msg } | 404 not found | 403 not owner
 */
export const deleteJob = async (req, res) => {
  // TODO:
  //  1. find job -> NotFoundError
  //  2. checkPermissions -> ForbiddenError
  //  3. job.deleteOne()
  //  4. respond 200 with { msg: 'Job removed' }
  res.status(StatusCodes.NOT_IMPLEMENTED).json({ msg: 'deleteJob not implemented' });
};
