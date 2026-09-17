import mongoose from 'mongoose';

/**
 * Job model
 *
 * The status and jobType values must stay in sync with the selects on the
 * client (see client/src/utils/constants.js).
 */
const JobSchema = new mongoose.Schema(
  {
    company: {
      type: String,
      required: [true, 'Please provide a company'],
      maxlength: [100, 'Company cannot be longer than 100 characters'],
      trim: true,
    },
    position: {
      type: String,
      required: [true, 'Please provide a position'],
      maxlength: [100, 'Position cannot be longer than 100 characters'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'interview', 'declined'],
        message: '{VALUE} is not a supported status',
      },
      default: 'pending',
    },
    jobType: {
      type: String,
      enum: {
        values: ['full-time', 'part-time', 'remote'],
        message: '{VALUE} is not a supported job type',
      },
      default: 'full-time',
    },
    jobLocation: {
      type: String,
      required: [true, 'Please provide a job location'],
      maxlength: [100, 'Job location cannot be longer than 100 characters'],
      trim: true,
    },
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide a user'],
    },
    // v2: the source of truth for permissions. createdBy above stays as an
    // audit trail of who added the job.
    organization: {
      type: mongoose.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Please provide an organization'],
    },
  },
  { timestamps: true }
);

// v1 listing, and the migration's "jobs created by this user" lookup.
JobSchema.index({ createdBy: 1, createdAt: -1 });

// v2: every listing and the stats pipeline start with { organization }, and
// the stats month branch range-scans createdAt within it.
JobSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model('Job', JobSchema);
