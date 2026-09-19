import 'express-async-errors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/authRoutes.js';
import jobsRouter from './routes/jobsRoutes.js';
import orgsRouter from './routes/orgsRoutes.js';
import invitationsRouter from './routes/invitationsRoutes.js';
import statsRouter from './routes/statsRoutes.js';
import authenticateUser from './middleware/auth.js';
import resolveOrg from './middleware/resolveOrg.js';
import notFoundMiddleware from './middleware/notFound.js';
import errorHandlerMiddleware from './middleware/errorHandler.js';

/**
 * The Express app, without a database connection or a listening socket.
 *
 * Splitting this from server.js lets the test suite mount the exact same app
 * on top of an in-memory MongoDB via supertest, with no port and no .env.
 */
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Render ends HTTPS at its proxy and forwards plain HTTP, recording the
// original scheme in X-Forwarded-Proto. Trusting that one hop is what makes
// req.protocol read "https", and the invitation controller builds links from
// it. Without this, live invite links began with http:// and sent the raw
// token over an unencrypted first hop before Render redirected.
//
// Exactly one hop, not `true`: trusting every hop would let a client forge
// the header through any chain. With no proxy in front (local development),
// a spoofed header can only change the link returned to that same caller.
app.set('trust proxy', 1);

app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Public
app.use('/api/v1/auth', authRouter);
// Accepting an invitation may be done signed-in or not, so the router decides.
app.use('/api/v1/invitations', invitationsRouter);

// Signed-in, no org context needed (listing / creating orgs)
app.use('/api/v1/orgs', authenticateUser, orgsRouter);

// Signed-in AND scoped to an active organization
app.use('/api/v1/jobs', authenticateUser, resolveOrg, jobsRouter);
app.use('/api/v1/stats', authenticateUser, resolveOrg, statsRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
