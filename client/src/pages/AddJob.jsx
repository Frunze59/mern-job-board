import customFetch from '../utils/customFetch';
import { JobForm } from '../components';

/**
 * /dashboard/add-job
 *
 * The form is cleared after a successful create so several jobs can be added
 * in a row without leaving the page.
 */
const AddJob = () => {
  const handleSubmit = async (values) => {
    await customFetch.post('/jobs', values);
  };

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
