/**
 * Render a job's createdAt as a short, readable date (e.g. "9 Sep 2026").
 * Falls back to an empty string rather than "Invalid Date" if the value is
 * missing or unparseable.
 */
const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default formatDate;
