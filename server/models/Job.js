import mongoose from 'mongoose';

/**
 * Job model
 *
 * Fields:
 *  - company      String, required
 *  - position     String, required
 *  - status       enum: pending | interview | declined   (default: pending)
 *  - jobType      enum: full-time | part-time | remote   (default: full-time)
 *  - jobLocation  String, required
 *  - createdBy    ObjectId ref 'User', required
 *  - timestamps
 */
const JobSchema = new mongoose.Schema(
  {
    // TODO: define company, position, status, jobType, jobLocation, createdBy
  },
  { timestamps: true }
);

export default mongoose.model('Job', JobSchema);
