import { useEffect, useState } from 'react';
import FormRow from './FormRow';
import FormRowSelect from './FormRowSelect';
import { ALL, JOB_SORT_BY, JOB_STATUS, JOB_TYPE } from '../utils/constants';

const STATUS_OPTIONS = [ALL, ...Object.values(JOB_STATUS)];
const TYPE_OPTIONS = [ALL, ...Object.values(JOB_TYPE)];
const SORT_OPTIONS = Object.values(JOB_SORT_BY);

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Filter bar for the job list.
 *
 * The search box keeps its own value so typing stays responsive, and reports
 * upwards only after a short pause. Without that debounce every keystroke
 * would fire a request.
 *
 * `values.search` seeds the box once, at mount. The parent remounts this
 * component (via a changing key) when it resets the filters, which clears the
 * box without an effect that mirrors a prop into state.
 */
const SearchContainer = ({ values, onChange, onReset, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState(values.search);

  useEffect(() => {
    if (searchTerm === values.search) return undefined;
    const timer = setTimeout(
      () => onChange('search', searchTerm),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [searchTerm, values.search, onChange]);

  const handleSelect = (event) => onChange(event.target.name, event.target.value);

  return (
    <section className="search-container">
      <form className="form form-wide" onSubmit={(event) => event.preventDefault()}>
        <h4>search form</h4>
        <div className="form-grid">
          <FormRow
            type="search"
            name="search"
            labelText="search position"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            required={false}
          />
          <FormRowSelect
            name="status"
            list={STATUS_OPTIONS}
            value={values.status}
            onChange={handleSelect}
          />
          <FormRowSelect
            name="jobType"
            labelText="job type"
            list={TYPE_OPTIONS}
            value={values.jobType}
            onChange={handleSelect}
          />
          <FormRowSelect
            name="sort"
            list={SORT_OPTIONS}
            value={values.sort}
            onChange={handleSelect}
          />
          <button
            type="button"
            className="btn btn-block btn-muted form-submit"
            onClick={onReset}
            disabled={isLoading}
          >
            reset filters
          </button>
        </div>
      </form>
    </section>
  );
};

export default SearchContainer;
