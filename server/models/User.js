import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * User model
 *
 * Fields:
 *  - name      String, required
 *  - email     String, required, unique (validated format)
 *  - password  String, required, hashed with bcryptjs, never returned by default
 *  - timestamps
 */
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      minlength: 3,
      maxlength: 50,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      match: [
        /^[\w.+-]+@[\w-]+\.[\w.-]+$/,
        'Please provide a valid email',
      ],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      // Never ship the hash to the client. Queries that need it (login) must
      // opt back in with .select('+password').
      select: false,
    },
  },
  { timestamps: true }
);

/**
 * Hash the password before saving. Guarded by isModified so that updating any
 * other field (or re-saving the document) does not re-hash an existing hash.
 */
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Sign a JWT for this user. The payload carries userId, which the auth
 * middleware reads back into req.user.
 */
UserSchema.methods.createJWT = function () {
  return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_LIFETIME || '1d',
  });
};

/**
 * Compare a plain-text password against this user's stored hash.
 * Requires the document to have been loaded with .select('+password').
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);
