// import { useState, useEffect } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import customFetch from '../utils/customFetch';

/**
 * /dashboard/edit-job/:id
 *
 * TODO:
 *  - read id from useParams()
 *  - load the job to prefill the form (GET /jobs, find by id, or pass via router state)
 *  - PATCH /jobs/:id on submit
 *  - success / error feedback, navigate back to /dashboard/all-jobs
 */
const EditJob = () => {
  return (
    <section>
      <form className="form">
        <h3>Edit Job</h3>
        {/* TODO: same fields as AddJob, prefilled */}
        <button type="submit" className="btn btn-block">
          save changes
        </button>
      </form>
    </section>
  );
};

export default EditJob;
