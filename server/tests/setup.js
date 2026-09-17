import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * One in-memory MongoDB for the whole test file, wiped between tests.
 * No .env is read: the secret below is what every test-issued JWT is signed
 * with, so the middleware and the helpers agree.
 */
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_LIFETIME = '1d';
process.env.NODE_ENV = 'test';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});
