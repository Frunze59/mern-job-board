import customFetch from '../utils/customFetch';
import { JobForm, ReadOnlyNotice } from '../components';
import { useDashboardContext } from '../context/DashboardContext';

/**
 * /dashboard/add-job
 *
 * The form is cleared after a successful create so several jobs can be added
 * in a row without leaving the page.
 *
 * The new job lands in the active org: the server takes it from the X-Org-Id
 * header, never from the form, so there is nothing here to choose or send.
 */
const AddJob = () => {
  const { canWrite } = useDashboardContext();

  const handleSubmit = async (values) => {
    await customFetch.post('/jobs', values);
  };

  // The sidebar link is hidden for viewers, but the URL can still be typed.
  if (!canWrite) return <ReadOnlyNotice />;

  return (
    <JobForm
      heading="Add Job"
      submitLabel="submit"
      successMessage="Job added"
      resetOnSuccess
      onSubmit={handleSubmit}
    />
  );
};

export default AddJob;
