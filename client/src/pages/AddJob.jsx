// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import customFetch from '../utils/customFetch';
// import { FormRow, FormRowSelect } from '../components';
// import { JOB_STATUS, JOB_TYPE } from '../utils/constants';

/**
 * /dashboard/add-job
 *
 * TODO:
 *  - form fields: position, company, jobLocation, status (select), jobType (select)
 *  - POST /jobs on submit
 *  - show success / error feedback, then navigate('/dashboard/all-jobs')
 *  - consider extracting a shared <JobForm /> used by both AddJob and EditJob
 */
const AddJob = () => {
  return (
    <section>
      <form className="form">
        <h3>Add Job</h3>
        {/* TODO: FormRow / FormRowSelect fields */}
        <button type="submit" className="btn btn-block">
          submit
        </button>
      </form>
    </section>
  );
};

export default AddJob;
