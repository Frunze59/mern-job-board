import { useEffect, useRef, useState } from 'react';
import customFetch, { getErrorMessage } from '../utils/customFetch';
import FormRow from './FormRow';
import FormRowSelect from './FormRowSelect';
import formatDate from '../utils/formatDate';
import { ROLES } from '../utils/constants';

/** How long the "copied" confirmation stays up. */
const COPIED_MS = 2000;

/**
 * Invite someone into this organization. Owners only; the parent decides
 * whether to render it, and the server checks again.
 *
 * Nothing is emailed. The server hands back a URL and the owner passes it on
 * however they like, which is the deliberate trade recorded in ADR-003: no
 * mail provider to configure, and nothing to go wrong in a reviewer's inbox.
 *
 * The raw token exists in this one response and nowhere else -- the database
 * stores only its hash -- so the link is never cleared from the screen by a
 * later action, and the form says as much. Losing it is not fatal: inviting
 * the same address again supersedes the old invitation and issues a new link.
 */
const InviteForm = ({ orgId, defaultRole = 'recruiter' }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  // '' | 'copied' | 'failed'
  const [copyState, setCopyState] = useState('');
  const linkRef = useRef(null);

  // Let the confirmation fade by itself rather than leaving it up forever.
  useEffect(() => {
    if (copyState !== 'copied') return undefined;
    const timer = setTimeout(() => setCopyState(''), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please provide an email address');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { data } = await customFetch.post(`/orgs/${orgId}/invitations`, {
        email: trimmed,
        role,
      });
      setResult(data);
      setCopyState('');
      // Clear the address so the next invite starts fresh, but keep the role:
      // people are usually added in batches with the same one.
      setEmail('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * The Clipboard API needs a secure context, so it is simply missing over
   * plain HTTP and can be refused even on HTTPS. It is therefore treated as a
   * convenience: the link is always on screen in a field the user can select,
   * and a failure says so instead of pretending the copy worked.
   */
  const handleCopy = async () => {
    if (!navigator.clipboard) {
      setCopyState('failed');
      linkRef.current?.select();
      return;
    }
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
      linkRef.current?.select();
    }
  };

  return (
    <form className="form form-wide" onSubmit={handleSubmit}>
      <h3>Invite a colleague</h3>

      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}

      <div className="form-grid">
        <FormRow
          type="email"
          name="email"
          labelText="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
        <FormRowSelect
          name="role"
          list={ROLES}
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
        <button type="submit" className="btn btn-block form-submit" disabled={isLoading}>
          {isLoading ? 'creating...' : 'create invite link'}
        </button>
      </div>

      {result && (
        <div className="invite-result">
          <p className="invite-summary">
            Invitation for <strong>{result.invitation.email}</strong> as{' '}
            <strong>{result.invitation.role}</strong>, valid until{' '}
            {formatDate(result.invitation.expiresAt)}.
          </p>

          <label htmlFor="invite-url" className="form-label">
            invite link
          </label>
          <div className="invite-link-row">
            <input
              id="invite-url"
              ref={linkRef}
              className="form-input"
              type="text"
              value={result.inviteUrl}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <button type="button" className="btn" onClick={handleCopy}>
              {copyState === 'copied' ? 'copied' : 'copy'}
            </button>
          </div>

          <p className="form-hint form-hint-left" role="status">
            {copyState === 'failed'
              ? 'Could not reach the clipboard. The link is selected above; copy it manually.'
              : 'Send this link yourself. It is shown once, and it is the only way in — ' +
                'invite the same address again to replace it. The new member appears in the ' +
                'list above once they accept.'}
          </p>
        </div>
      )}
    </form>
  );
};

export default InviteForm;
