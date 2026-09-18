import { Outlet } from 'react-router-dom';
import { Navbar, Sidebar } from '../components';
import { DashboardProvider, useDashboardContext } from '../context/DashboardContext';

/**
 * Everything inside the provider, so it can read the org state.
 *
 * Child pages are not rendered until the org list has arrived. They fetch on
 * mount, and a request sent before the active org is settled would be answered
 * for the Personal org and then have to be thrown away and repeated. Waiting
 * costs one short spinner and makes every page load exactly one request per
 * page.
 *
 * The page container is keyed on the active org, so switching orgs remounts
 * the whole subtree. That is deliberate: it refetches, and it also drops
 * filters, the page number and any half-typed form, none of which mean
 * anything in the org the user just moved to.
 */
const DashboardShell = () => {
  const { activeOrg, isLoadingOrgs, orgsError } = useDashboardContext();

  return (
    <section className="dashboard">
      <Sidebar />
      <div className="dashboard-main">
        <Navbar />
        <div className="dashboard-page" key={activeOrg?._id ?? 'no-org'}>
          {isLoadingOrgs && <p className="empty-state">Loading your organizations...</p>}

          {!isLoadingOrgs && orgsError && (
            <p className="alert alert-danger" role="alert">
              {orgsError}
            </p>
          )}

          {/* Registration always creates a Personal org, so an account with
              none has inconsistent data rather than an empty account. Say so
              instead of rendering pages that would all fail. */}
          {!isLoadingOrgs && !orgsError && !activeOrg && (
            <p className="alert alert-danger" role="alert">
              This account does not belong to any organization.
            </p>
          )}

          {!isLoadingOrgs && !orgsError && activeOrg && <Outlet />}
        </div>
      </div>
    </section>
  );
};

/**
 * Nested layout route for /dashboard/*.
 * Shared navbar + sidebar; child pages render inside <Outlet />.
 */
const DashboardLayout = () => (
  <DashboardProvider>
    <DashboardShell />
  </DashboardProvider>
);

export default DashboardLayout;
