import { useEffect, useState } from 'react';
import customFetch, { getErrorMessage } from '../utils/customFetch';
import { useDashboardContext } from '../context/DashboardContext';
import { JOB_STATUS } from '../utils/constants';

/** The three statuses in the order the tiles show them. */
const STATUSES = Object.values(JOB_STATUS);

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "2026-04" -> "Apr 2026", by splitting the string rather than parsing a Date.
 *
 * new Date('2026-04') is read as midnight UTC, so formatting it in a local
 * timezone behind UTC would print March and every bar would be labelled with
 * the wrong month. The server buckets these in UTC on purpose; reading the
 * parts directly is the one way to be sure the label matches the bucket.
 */
const monthLabel = (key) => {
  const [year, month] = String(key).split('-');
  return `${MONTH_NAMES[Number(month) - 1] ?? key} ${year}`;
};

/**
 * /dashboard/stats
 *
 * One request, one aggregation behind it, no query params. Everything on this
 * page is counted by MongoDB; the only arithmetic here is turning counts into
 * bar widths.
 *
 * Any role may look: reading numbers is not a write. Like every other page it
 * is scoped to the active org by the X-Org-Id header, and switching orgs
 * remounts it, which is what refetches.
 */
const Stats = () => {
  const { activeOrg } = useDashboardContext();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const { data } = await customFetch.get('/stats');
        if (!cancelled) setStats(data);
      } catch (requestError) {
        if (!cancelled) setError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return <p className="empty-state">Loading stats...</p>;

  if (error) {
    return (
      <p className="alert alert-danger" role="alert">
        {error}
      </p>
    );
  }

  const { countsByStatus, applicationsPerMonth, topCompanies } = stats;
  const total = STATUSES.reduce((sum, status) => sum + (countsByStatus[status] ?? 0), 0);

  // Bars are drawn relative to the busiest month. No divide-by-zero guard is
  // needed here: a fill is only rendered when that month's count is above
  // zero, and in that case the busiest month is at least that count.
  const busiestMonth = Math.max(...applicationsPerMonth.map((entry) => entry.count));

  return (
    <section className="stats-page">
      <h2>Stats</h2>
      <p className="page-subtitle">
        {activeOrg.name} &middot; {total} job{total === 1 ? '' : 's'} in total
      </p>

      {total === 0 && (
        <p className="notice">
          No jobs in this organization yet, so everything below is zero.
        </p>
      )}

      <div className="stat-tiles">
        {STATUSES.map((status) => (
          <article key={status} className={`stat-tile stat-tile-${status}`}>
            <p className="stat-number">{countsByStatus[status] ?? 0}</p>
            <h5 className="stat-label">{status}</h5>
          </article>
        ))}
      </div>

      <h4 className="stats-heading">Applications per month</h4>
      {/* The count is written out next to every bar, so the numbers are
          readable whether or not the bar renders. The bar itself is decoration
          and is hidden from assistive technology. */}
      <ul className="bar-list">
        {applicationsPerMonth.map((entry) => (
          <li key={entry.month} className="bar-row">
            <span className="bar-label">{monthLabel(entry.month)}</span>
            <span className="bar-track" aria-hidden="true">
              {/* Nothing is drawn for a month with no jobs. The fill carries a
                  minimum width so a count of 1 against a busy month is still
                  visible, and that minimum would otherwise turn a zero into a
                  sliver that looks like a small number. */}
              {entry.count > 0 && (
                <span
                  className="bar-fill"
                  style={{ width: `${(entry.count / busiestMonth) * 100}%` }}
                />
              )}
            </span>
            <span className="bar-value">{entry.count}</span>
          </li>
        ))}
      </ul>

      <h4 className="stats-heading">Top companies</h4>
      {topCompanies.length === 0 ? (
        <p className="empty-state">No companies to rank yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {topCompanies.map((entry) => (
                <tr key={entry.company}>
                  <td>{entry.company}</td>
                  <td>{entry.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default Stats;
