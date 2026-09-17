import crypto from 'crypto';
import mongoose from 'mongoose';
import { ROLES } from './Membership.js';

export const INVITATION_TTL_DAYS = 7;
export const INVITATION_STATUSES = ['pending', 'accepted'];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Invitation to join an organization, delivered as a one-time token.
 *
 * Only a SHA-256 hash of the token is stored. The raw token is handed to the
 * inviter once, in the create response, and never persisted: if the database
 * leaks, the hashes cannot be used to join anything.
 */
const InvitationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Please provide an organization'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'Please provide a valid email'],
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: '{VALUE} is not a supported role' },
      required: [true, 'Please provide a role'],
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    invitedBy: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Belt and braces: the hash should never leave the server either.
      transform: (doc, ret) => {
        delete ret.tokenHash;
        return ret;
      },
    },
  }
);

// "Is this email already invited to this org?"
InvitationSchema.index({ organization: 1, email: 1 });

/** SHA-256 hex digest of a raw token. Used both to store and to look up. */
InvitationSchema.statics.hashToken = function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
};

/**
 * Create an invitation and return the raw token alongside it.
 * The raw token exists only in this return value.
 *
 * `now` is injectable so tests can pin the clock.
 */
InvitationSchema.statics.issue = async function issue({
  organization,
  email,
  role,
  invitedBy,
  now = new Date(),
}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const invitation = await this.create({
    organization,
    email,
    role,
    invitedBy,
    tokenHash: this.hashToken(rawToken),
    expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
  });
  return { invitation, rawToken };
};

/** Find an invitation by the raw token from the URL. */
InvitationSchema.statics.findByToken = function findByToken(rawToken) {
  return this.findOne({ tokenHash: this.hashToken(rawToken) });
};

InvitationSchema.methods.isExpired = function isExpired(now = new Date()) {
  return now.getTime() >= this.expiresAt.getTime();
};

/** Pending and not expired: the only state in which it may be accepted. */
InvitationSchema.methods.isUsable = function isUsable(now = new Date()) {
  return this.status === 'pending' && !this.isExpired(now);
};

export default mongoose.model('Invitation', InvitationSchema);
