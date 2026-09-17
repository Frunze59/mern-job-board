import express from 'express';
import { getStats } from '../controllers/statsController.js';

// authenticateUser + resolveOrg applied in app.js; any role may read stats.
const router = express.Router();

router.get('/', getStats);

export default router;
