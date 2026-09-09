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
  },
  { timestamps: true }
);

// Every jobs query is scoped to the owner and sorted or filtered on top of
// that, so index createdBy alongside createdAt to keep GET /jobs cheap.
JobSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model('Job', JobSchema);
