import express from 'express';
import {
  getAllJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
} from '../controllers/jobsController.js';
import requireRole from '../middleware/requireRole.js';
import { WRITE_ROLES } from '../models/Membership.js';

// authenticateUser and resolveOrg are applied to this whole router in app.js,
// so every handler below has req.user and req.org.
const router = express.Router();

// Any member may read; only owners and recruiters may write.
const canWrite = requireRole(...WRITE_ROLES);

router.route('/').get(getAllJobs).post(canWrite, createJob);
router
  .route('/:id')
  .get(getJob)
  .patch(canWrite, updateJob)
  .delete(canWrite, deleteJob);

export default router;
