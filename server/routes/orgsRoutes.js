import express from 'express';
import {
  getMyOrgs,
  createOrg,
  getMembers,
  createInvitation,
} from '../controllers/orgsController.js';

// authenticateUser is applied to this whole router in app.js.
// Org-membership and owner checks live in the controllers because the org is
// named in the URL here, not in the X-Org-Id header.
const router = express.Router();

router.route('/').get(getMyOrgs).post(createOrg);
router.get('/:orgId/members', getMembers);
router.post('/:orgId/invitations', createInvitation);

export default router;
