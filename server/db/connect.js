import mongoose from 'mongoose';

/**
 * Connects to MongoDB Atlas using the connection string from .env (MONGO_URL).
 */
const connectDB = (url) => {
  if (!url) {
    throw new Error('MONGO_URL is not defined. Add it to your .env file.');
  }
  return mongoose.connect(url);
};

export default connectDB;
