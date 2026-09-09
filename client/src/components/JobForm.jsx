import { useState } from 'react';
import FormRow from './FormRow';
import FormRowSelect from './FormRowSelect';
import { getErrorMessage } from '../utils/customFetch';
import { EMPTY_JOB, JOB_STATUS, JOB_TYPE } from '../utils/constants';

const STATUS_OPTIONS = Object.values(JOB_STATUS);
const TYPE_OPTIONS = Object.values(JOB_TYPE);

/**
 * The job form shared by Add Job and Edit Job.
 *
 * The parent supplies `onSubmit(values)` and does the actual request, so this
 * component stays unaware of whether it is creating or updating. It owns the
 * field state, the client-side check and the success / error feedback.
 *
 * `initialValues` is read once, when the form mounts. A parent loading a job
 * asynchronously should therefore render this only after the data has arrived.
 */
const JobForm = ({
  heading,
  initialValues = EMPTY_JOB,
  submitLabel = 'submit',
  successMessage = 'Saved',
  resetOnSuccess = false,
  onSubmit,
}) => {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Trim before validating: the HTML `required` attribute accepts a string
    // of spaces, which would otherwise only be rejected by the server.
    const trimmed = {
      ...values,
      position: values.position.trim(),
      company: values.company.trim(),
      jobLocation: values.jobLocation.trim(),
    };

    if (!trimmed.position || !trimmed.company || !trimmed.jobLocation) {
      setSuccess('');
      setError('Please provide position, company and job location');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await onSubmit(trimmed);
      setSuccess(successMessage);
      if (resetOnSuccess) setValues(EMPTY_JOB);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="form-section">
      <form className="form form-wide" onSubmit={handleSubmit}>
        <h3>{heading}</h3>

        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="alert alert-success" role="status">
            {success}
          </p>
        )}

        <div className="form-grid">
          <FormRow
            type="text"
            name="position"
            value={values.position}
            onChange={handleChange}
          />
          <FormRow
            type="text"
            name="company"
            value={values.company}
            onChange={handleChange}
          />
          <FormRow
            type="text"
            name="jobLocation"
            labelText="job location"
            value={values.jobLocation}
            onChange={handleChange}
          />
          <FormRowSelect
            name="status"
            list={STATUS_OPTIONS}
            value={values.status}
            onChange={handleChange}
          />
          <FormRowSelect
            name="jobType"
            labelText="job type"
            list={TYPE_OPTIONS}
            value={values.jobType}
            onChange={handleChange}
          />
          <button type="submit" className="btn btn-block form-submit" disabled={isLoading}>
            {isLoading ? 'submitting...' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
};

export default JobForm;
