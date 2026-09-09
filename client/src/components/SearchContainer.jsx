// import { FormRow, FormRowSelect } from './index';
// import { JOB_STATUS, JOB_TYPE, JOB_SORT_BY } from '../utils/constants';

/**
 * Filters for AllJobs: search input, status select, jobType select, sort select, reset button.
 * props: values, onChange, onReset
 * TODO: debounce the search input.
 */
const SearchContainer = () => {
  return (
    <section className="search-container">
      <form className="form">
        <h5>search form</h5>
        {/* TODO: FormRow search, FormRowSelect status/jobType/sort */}
        <button type="button" className="btn">
          reset
        </button>
      </form>
    </section>
  );
};

export default SearchContainer;
