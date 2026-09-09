export const JOB_STATUS = {
  PENDING: 'pending',
  INTERVIEW: 'interview',
  DECLINED: 'declined',
};

export const JOB_TYPE = {
  FULL_TIME: 'full-time',
  PART_TIME: 'part-time',
  REMOTE: 'remote',
};

export const JOB_SORT_BY = {
  NEWEST_FIRST: 'latest',
  OLDEST_FIRST: 'oldest',
  ASCENDING: 'a-z',
  DESCENDING: 'z-a',
};

/** Blank job used to seed the Add Job form. */
export const EMPTY_JOB = {
  position: '',
  company: '',
  jobLocation: '',
  status: JOB_STATUS.PENDING,
  jobType: JOB_TYPE.FULL_TIME,
};

/** 'all' is the API's wildcard for the status and jobType filters. */
export const ALL = 'all';

/** Starting state for the All Jobs filter bar. */
export const DEFAULT_JOB_FILTERS = {
  search: '',
  status: ALL,
  jobType: ALL,
  sort: JOB_SORT_BY.NEWEST_FIRST,
  page: 1,
};
