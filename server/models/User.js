import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';

/**
 * User model
 *
 * Fields:
 *  - name      String, required
 *  - email     String, required, unique (validate format)
 *  - password  String, required, hashed with bcryptjs (select: false is a nice touch)
 *  - timestamps
 */
const UserSchema = new mongoose.Schema(
  {
    // TODO: define name, email, password
  },
  { timestamps: true }
);

// TODO: pre('save') hook -> hash password with bcrypt when it is new/modified
// UserSchema.pre('save', async function () { ... });

// TODO: instance method -> create JWT signed with process.env.JWT_SECRET,
//       expiresIn: process.env.JWT_LIFETIME (1d)
// UserSchema.methods.createJWT = function () { ... };

// TODO: instance method -> compare a candidate password with the hash
// UserSchema.methods.comparePassword = async function (candidatePassword) { ... };

export default mongoose.model('User', UserSchema);
