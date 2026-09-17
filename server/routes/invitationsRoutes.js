import express from 'express';
import { getInvitation, acceptInvitation } from '../controllers/invitationsController.js';

// Deliberately NOT behind authenticateUser: a brand-new invitee has no token.
// The accept handler inspects the Authorization header itself.
const router = express.Router();

router.get('/:token', getInvitation);
router.post('/:token/accept', acceptInvitation);

export default router;
