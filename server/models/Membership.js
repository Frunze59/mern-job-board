import mongoose from 'mongoose';

export const ROLES = ['owner', 'recruiter', 'viewer'];

/**
 * Membership links a User to an Organization with a role.
 *
 *  - user          ref User, required
 *  - organization  ref Organization, required
 *  - role          enum ROLES, required
 *  - timestamps
 *
 * One membership per (user, organization): enforce with a unique compound
 * index. Without it, two concurrent invitation accepts could create two rows
 * and the role check would become ambiguous.
 *
 * TODO: fields + MembershipSchema.index({ user: 1, organization: 1 }, { unique: true })
 */
const MembershipSchema = new mongoose.Schema(
  {
    // TODO
  },
  { timestamps: true }
);

export default mongoose.model('Membership', MembershipSchema);
