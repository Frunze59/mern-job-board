import express from 'express';
import {
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
} from '../controllers/jobsController.js';

// authenticateUser is applied to this whole router in server.js
const router = express.Router();

router.route('/').get(getAllJobs).post(createJob);
router.route('/:id').patch(updateJob).delete(deleteJob);

export default router;
