import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import customFetch, { getErrorMessage } from '../utils/customFetch';
import { JobForm } from '../components';

/** Milliseconds the success message stays up before returning to the list. */
const REDIRECT_DELAY_MS = 1200;

/**
 * /dashboard/edit-job/:id
 *
 * Loads the job from the API rather than relying on router state, so the page
 * still works on a refresh or when the URL is opened directly.
 *
 * JobForm reads its initial values once, at mount, so it is rendered only after
 * the job has arrived.
 */
const EditJob = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    // Ignore a response that arrives after the user has navigated away.
    let cancelled = false;

    const loadJob = async () => {
      try {
        const { data } = await customFetch.get(`/jobs/${id}`);
        if (!cancelled) setJob(data.job);
      } catch (requestError) {
        if (!cancelled) setLoadError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadJob();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Give the success message a moment to be read, then go back to the list.
  useEffect(() => {
    if (!savedAt) return undefined;
    const timer = setTimeout(
      () => navigate('/dashboard/all-jobs'),
      REDIRECT_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [savedAt, navigate]);

  const handleSubmit = async (values) => {
    await customFetch.patch(`/jobs/${id}`, values);
    setSavedAt(Date.now());
  };

  if (isLoading) {
    return <p className="empty-state">Loading job...</p>;
  }

  if (loadError) {
    return (
      <section>
        <p className="alert alert-danger" role="alert">
          {loadError}
        </p>
        <Link to="/dashboard/all-jobs" className="btn">
          back to all jobs
        </Link>
      </section>
    );
  }

  return (
    <>
      <JobForm
        heading="Edit Job"
        initialValues={{
          position: job.position,
          company: job.company,
          jobLocation: job.jobLocation,
          status: job.status,
          jobType: job.jobType,
        }}
        submitLabel="save changes"
        successMessage="Job updated"
        onSubmit={handleSubmit}
      />
      <p className="form-hint form-hint-left">
        <Link to="/dashboard/all-jobs">back to all jobs</Link>
      </p>
    </>
  );
};

export default EditJob;
