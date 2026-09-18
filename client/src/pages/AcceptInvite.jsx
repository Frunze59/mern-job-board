import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import customFetch, {
  clearSession,
  getErrorMessage,
  readStoredUser,
  TOKEN_KEY,
  USER_KEY,
} from '../utils/customFetch';
import { ACTIVE_ORG_KEY } from '../utils/constants';
import { FormRow, Logo } from '../components';
import formatDate from '../utils/formatDate';

/** Mirrors the minlength on the User schema, so the check is instant. */
const MIN_PASSWORD = 6;

/** The signed-in session, or null. Read once, then kept in state so that
 *  signing out from this page re-renders it into the other branch. */
const readSession = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { token, email: readStoredUser()?.email ?? null };
};

/**
 * /invitations/:token   (public)
 *
 * Public because a brand-new invitee has no account yet. The page first asks
 * the server what the link is for, then shows one of two things:
 *
 *   signed in  -> a confirm button, because the account already exists
 *   signed out -> a password field, because accepting also registers them
 *
 * Which branch applies is decided from the invited address, not from a failed
 * request: the invitation names the email and the browser knows who is signed
 * in, so somebody signed in as the wrong person is told before they click
 * rather than after. The server checks it again regardless, and that answer is
 * handled too, because the stored copy could be stale or hand-edited.
 */
const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [session, setSession] = useState(readSession);
  const [values, setValues] = useState({ name: '', password: '' });
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set when the invited address already has an account, which is the one
  // error with a next step worth linking to.
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadInvitation = async () => {
      try {
        const { data } = await customFetch.get(`/invitations/${token}`);
        if (!cancelled) setInvitation(data);
      } catch (requestError) {
        // 404 unknown, 410 used or expired. The server's message already says
        // which, so it is shown as-is rather than being guessed at again here.
        if (!cancelled) setLoadError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadInvitation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /**
   * Land in the organization that was just joined.
   *
   * The active org is written before navigating, because the dashboard reads
   * it from storage as it mounts. Setting it afterwards would show the new
   * member their Personal org and make them find the switcher.
   */
  const enterDashboard = (org) => {
    localStorage.setItem(ACTIVE_ORG_KEY, org._id);
    // replace: the token is spent, so going back to this page would only show
    // "already used".
    navigate('/dashboard', { replace: true });
  };

  const signOut = () => {
    clearSession();
    setSession(null);
    setSubmitError('');
    setNeedsSignIn(false);
  };

  /** Signed-in branch: no body, the Bearer header identifies the caller. */
  const handleJoin = async () => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const { data } = await customFetch.post(`/invitations/${token}/accept`);
      enterDashboard(data.org);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        // The stored token was expired or malformed. The interceptor leaves
        // /invitations alone precisely so this page can recover in place
        // instead of redirecting and losing the invite URL.
        signOut();
        setNotice('Your session had expired, so you have been signed out. Continue below.');
      } else {
        setSubmitError(getErrorMessage(requestError));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Signed-out branch: accepting the invite also creates the account. */
  const handleCreateAccount = async (event) => {
    event.preventDefault();

    if (values.password.length < MIN_PASSWORD) {
      setSubmitError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }

    setSubmitError('');
    setNeedsSignIn(false);
    setIsSubmitting(true);
    try {
      const { data } = await customFetch.post(`/invitations/${token}/accept`, {
        password: values.password,
        // Optional: the server falls back to the part before the @.
        name: values.name.trim() || undefined,
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      enterDashboard(data.org);
    } catch (requestError) {
      // 403 here means the address already has an account. ADR-003: it is sent
      // to the sign-in page rather than being allowed to give a password to an
      // endpoint that does not check the old one.
      if (requestError.response?.status === 403) setNeedsSignIn(true);
      setSubmitError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  if (isLoading) {
    return (
      <main className="form-page">
        <div className="form">
          <p className="empty-state">Checking this invitation...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="form-page">
        <div className="form">
          <div className="form-logo">
            <Logo />
          </div>
          <h3>This link cannot be used</h3>
          <p className="alert alert-danger" role="alert">
            {loadError}
          </p>
          <p className="form-hint">
            Ask whoever invited you to send a new link. <Link to="/">Back home</Link>
          </p>
        </div>
      </main>
    );
  }

  const wrongAccount = session && session.email !== invitation.email;

  return (
    <main className="form-page">
      <div className="form">
        <div className="form-logo">
          <Logo />
        </div>

        <h3>Join {invitation.orgName}</h3>
        <p className="invite-intro">
          <strong>{invitation.email}</strong> has been invited as{' '}
          <strong>{invitation.role}</strong>. This link is valid until{' '}
          {formatDate(invitation.expiresAt)}.
        </p>

        {notice && (
          <p className="alert alert-success" role="status">
            {notice}
          </p>
        )}
        {submitError && (
          <p className="alert alert-danger" role="alert">
            {submitError}
          </p>
        )}
        {needsSignIn && (
          <p className="form-hint">
            <Link to="/register">Go to sign in</Link>, then open this link again.
          </p>
        )}

        {wrongAccount && (
          <>
            <p className="invite-intro">
              You are signed in as <strong>{session.email || 'another account'}</strong>, so
              you cannot accept this one.
            </p>
            <button type="button" className="btn btn-block" onClick={signOut}>
              sign out and continue
            </button>
          </>
        )}

        {session && !wrongAccount && (
          <button
            type="button"
            className="btn btn-block"
            onClick={handleJoin}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'joining...' : `join as ${invitation.role}`}
          </button>
        )}

        {!session && (
          <form onSubmit={handleCreateAccount}>
            <p className="invite-intro">
              Choose a password to create your account. Your email is taken from the
              invitation and cannot be changed here.
            </p>
            <FormRow
              type="text"
              name="name"
              labelText="name (optional)"
              value={values.name}
              onChange={handleChange}
              autoComplete="name"
              required={false}
            />
            <FormRow
              type="password"
              name="password"
              value={values.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <button type="submit" className="btn btn-block" disabled={isSubmitting}>
              {isSubmitting ? 'creating account...' : 'create account and join'}
            </button>
          </form>
        )}

        <p className="form-hint">
          <Link to="/">Back home</Link>
        </p>
      </div>
    </main>
  );
};

export default AcceptInvite;
