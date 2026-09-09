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
