import mongoose from 'mongoose';
// import crypto from 'crypto';

/**
 * Invitation to join an organization, delivered as a one-time token.
 *
 *  - organization  ref Organization, required
 *  - email         String, required, lowercase, trimmed (who may accept)
 *  - role          enum owner|recruiter|viewer, required
 *  - tokenHash     String, unique. SHA-256 of the raw token. The raw token is
 *                  returned to the inviter once and never stored: if the
 *                  database leaks, the hashes cannot be used to join anything.
 *  - status        enum pending|accepted, default pending
 *  - expiresAt     Date, required (created + 7 days)
 *  - invitedBy     ref User
 *  - timestamps
 *
 * TODO:
 *  1. fields above
 *  2. static Invitation.hashToken(raw) -> sha256 hex
 *  3. static Invitation.issue({ organization, email, role, invitedBy })
 *       -> generates crypto.randomBytes(32).toString('hex'), saves the hash,
 *          returns { invitation, rawToken }
 *  4. method invitation.isExpired() -> Date.now() > expiresAt
 *  5. index on { organization: 1, email: 1 } for "already invited?" lookups
 */
const InvitationSchema = new mongoose.Schema(
  {
    // TODO
  },
  { timestamps: true }
);

export default mongoose.model('Invitation', InvitationSchema);
