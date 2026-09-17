// import { useEffect, useState } from 'react';
// import { useNavigate, useParams } from 'react-router-dom';
// import customFetch, { getErrorMessage, TOKEN_KEY, USER_KEY } from '../utils/customFetch';

/**
 * /invitations/:token   (public)
 *
 * 1. GET /invitations/:token -> { email, role, orgName, expiresAt }
 *    404 / 410 -> show why the link is dead, with a way home.
 * 2. Decide which branch to show:
 *    - a token is in localStorage  -> "Join <org> as <email>" button
 *                                     POST accept with the Bearer header
 *                                     403 -> "you're signed in as someone else", offer logout
 *    - no token                    -> password (+ optional name) form
 *                                     POST accept with { password, name }
 *                                     201 -> store token + user, go to dashboard
 *                                     403 -> "this email already has an account, sign in"
 * 3. On success set the new org as active (localStorage activeOrgId).
 *
 * TODO: implement. This is the one page the brief suggests for RTL tests.
 */
const AcceptInvite = () => {
  return (
    <main className="form-page">
      <div className="form">
        <h3>Join organization</h3>
        <p className="empty-state">TODO: accept-invitation flow.</p>
      </div>
    </main>
  );
};

export default AcceptInvite;
