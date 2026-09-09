import { useCallback, useEffect, useState } from 'react';
import customFetch, { getErrorMessage } from '../utils/customFetch';
import { JobCard, PageBtnContainer, SearchContainer } from '../components';
import { DEFAULT_JOB_FILTERS } from '../utils/constants';

/**
 * /dashboard/all-jobs
 *
 * Holds the filter state and refetches whenever it changes. The server does the
 * filtering, sorting and paging, so this page only reports what was asked for.
 */
const AllJobs = () => {
  const [filters, setFilters] = useState(DEFAULT_JOB_FILTERS);
  const [result, setResult] = useState({ jobs: [], totalJobs: 0, numOfPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  // Bumped on reset to remount SearchContainer, clearing its search box.
  const [searchBoxKey, setSearchBoxKey] = useState(0);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await customFetch.get('/jobs', { params: filters });
      setResult(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setResult({ jobs: [], totalJobs: 0, numOfPages: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetching is synchronisation with an external system, which is exactly what
  // an effect is for; the loading flag it sets is part of that same update.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchJobs();
  }, [fetchJobs]);

  /**
   * Changing any filter returns to page one. Staying on, say, page three while
   * narrowing the results would otherwise show an empty list.
   */
  const updateFilter = useCallback((name, value) => {
    setFilters((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'page' ? {} : { page: 1 }),
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_JOB_FILTERS);
    setSearchBoxKey((previous) => previous + 1);
  }, []);

  const handleDelete = async (jobId) => {
    setDeletingId(jobId);
    setError('');
    try {
      await customFetch.delete(`/jobs/${jobId}`);
      // Deleting the only row on a page would strand the user on an empty page,
      // so step back one when that happens.
      if (result.jobs.length === 1 && filters.page > 1) {
        updateFilter('page', filters.page - 1);
      } else {
        await fetchJobs();
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingId('');
    }
  };

  const { jobs, totalJobs, numOfPages } = result;

  return (
    <>
      <SearchContainer
        key={searchBoxKey}
        values={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        isLoading={isLoading}
      />

      <h5 className="jobs-count">
        {isLoading
          ? 'loading...'
          : `${totalJobs} job${totalJobs === 1 ? '' : 's'} found`}
      </h5>

      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <p className="empty-state">No jobs to display.</p>
      )}

      <div className="jobs-grid">
        {jobs.map((job) => (
          <JobCard
            key={job._id}
            {...job}
            onDelete={handleDelete}
            isDeleting={deletingId === job._id}
          />
        ))}
      </div>

      {numOfPages > 1 && (
        <PageBtnContainer
          page={filters.page}
          numOfPages={numOfPages}
          onPageChange={(page) => updateFilter('page', page)}
        />
      )}
    </>
  );
};

export default AllJobs;
