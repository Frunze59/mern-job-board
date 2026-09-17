import mongoose from 'mongoose';

export const ROLES = ['owner', 'recruiter', 'viewer'];

/** Roles allowed to create, edit and delete jobs. */
export const WRITE_ROLES = ['owner', 'recruiter'];

/**
 * Membership links a User to an Organization with a role.
 * The role lives here, not on the user, because the same person can be an
 * owner in their Personal org and a viewer in someone else's.
 */
const MembershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide a user'],
    },
    organization: {
      type: mongoose.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Please provide an organization'],
    },
    role: {
      type: String,
      enum: { values: ROLES, message: '{VALUE} is not a supported role' },
      required: [true, 'Please provide a role'],
    },
  },
  { timestamps: true }
);

// One membership per user per org. Without this, two concurrent invitation
// accepts could create two rows with different roles and every role check
// would become ambiguous. The index also serves the lookup every org-scoped
// request makes: "what is this user's role in this org?"
MembershipSchema.index({ user: 1, organization: 1 }, { unique: true });

// "Who is in this org?" for the members page.
MembershipSchema.index({ organization: 1 });

export default mongoose.model('Membership', MembershipSchema);
