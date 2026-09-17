// import { useEffect, useState } from 'react';
// import customFetch, { getErrorMessage } from '../utils/customFetch';
// import { useDashboardContext } from '../context/DashboardContext';
// import { FormRow, FormRowSelect } from '../components';
// import { ROLES } from '../utils/constants';

/**
 * /dashboard/team
 *
 * Three things on one page, all scoped to the active org:
 *  - members list        GET  /orgs/:orgId/members
 *  - invite form         POST /orgs/:orgId/invitations   (owner only; hide for others)
 *    -> shows the returned inviteUrl with a copy button; there is no email
 *       sending, the owner pastes the link wherever they like
 *  - create org form     POST /orgs   (then switch to it)
 *
 * TODO: implement; read activeOrg + role from DashboardContext.
 */
const Team = () => {
  return (
    <section>
      <h2>Team</h2>
      <p className="empty-state">TODO: members, invite form, create organization.</p>
    </section>
  );
};

export default Team;
