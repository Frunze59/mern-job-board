import { useState } from 'react';
import customFetch, { getErrorMessage } from '../utils/customFetch';
import FormRow from './FormRow';

/**
 * Create a new organization. Any signed-in user may: this is how somebody
 * with only a Personal workspace starts a real team.
 *
 * POST /orgs is not in the brief's route table. It was added because an
 * organization had to come from somewhere, and inviting colleagues into a
 * workspace named "Personal" would be the wrong shape (see ADR-001).
 *
 * The caller becomes its owner, so on success the app switches to it. That
 * remounts this page, which is the feedback: the switcher shows the new name
 * and the members table shows one row, you.
 */
const CreateOrgForm = ({ onCreated }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please provide an organization name');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { data } = await customFetch.post('/orgs', { name: trimmed });
      // Switches the active org, so everything below unmounts. Nothing is set
      // after this line for that reason.
      await onCreated(data.org._id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setIsLoading(false);
    }
  };

  return (
    <form className="form form-wide" onSubmit={handleSubmit}>
      <h3>Create an organization</h3>

      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}

      <div className="form-grid">
        <FormRow
          type="text"
          name="orgName"
          labelText="organization name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-block form-submit" disabled={isLoading}>
          {isLoading ? 'creating...' : 'create and switch'}
        </button>
      </div>

      <p className="form-hint form-hint-left">
        You become its owner, and the app switches to it straight away.
      </p>
    </form>
  );
};

export default CreateOrgForm;
