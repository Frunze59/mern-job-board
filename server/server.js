import 'express-async-errors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './db/connect.js';
import authRouter from './routes/authRoutes.js';
import jobsRouter from './routes/jobsRoutes.js';
import authenticateUser from './middleware/auth.js';
import notFoundMiddleware from './middleware/notFound.js';
import errorHandlerMiddleware from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- global middleware ----------
app.use(express.json());

// ---------- routes ----------
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/jobs', authenticateUser, jobsRouter);

// ---------- production: serve the built React client ----------
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  // any non-API route falls back to index.html so React Router can handle it
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ---------- error handling (must be last) ----------
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}...`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
