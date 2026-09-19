import { Link } from 'react-router-dom';
import { useDashboardContext } from '../context/DashboardContext';

/**
 * Shown on a write page when the active role is viewer.
 *
 * The server refuses the write either way; this exists so the refusal arrives
 * before the form is filled in rather than after, and so it names the reason
 * (the role in this org) instead of showing a bare 403.
 */
const ReadOnlyNotice = () => {
  const { activeOrg } = useDashboardContext();

  return (
    <section>
      <h4>Read-only access</h4>
      <p className="empty-state">
        You are a {activeOrg?.role} in {activeOrg?.name}, so you can browse jobs but not
        change them. Switch organization in the top bar, or ask an owner for a different
        role.
      </p>
      <Link to="/dashboard/all-jobs" className="btn">
        back to all jobs
      </Link>
    </section>
  );
};

export default ReadOnlyNotice;
