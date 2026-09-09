// import { useState, useEffect } from 'react';
// import customFetch from '../utils/customFetch';
// import { SearchContainer, JobCard, PageBtnContainer } from '../components';

/**
 * /dashboard/all-jobs
 *
 * TODO:
 *  - filter state: { search: '', status: 'all', jobType: 'all', sort: 'latest', page: 1 }
 *  - GET /jobs with those as query params -> { jobs, totalJobs, numOfPages }
 *  - render <SearchContainer /> (search input, status/jobType/sort selects)
 *  - render "N jobs found" + a grid of <JobCard /> (edit + delete buttons)
 *  - render <PageBtnContainer /> when numOfPages > 1
 *  - delete: DELETE /jobs/:id then refetch
 */
const AllJobs = () => {
  return (
    <>
      {/* <SearchContainer /> */}
      <h2>All Jobs</h2>
      {/* jobs grid */}
      {/* <PageBtnContainer /> */}
    </>
  );
};

export default AllJobs;
