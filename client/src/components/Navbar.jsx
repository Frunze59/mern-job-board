import { useDashboardContext } from '../context/DashboardContext';
import { OrgSwitcher } from './index';

/**
 * Top bar of the dashboard: page title, the active organization, the
 * signed-in user, and logout.
 */
const Navbar = () => {
  const { user, logout } = useDashboardContext();

  return (
    <nav className="navbar">
      <h4>Dashboard</h4>
      <div className="navbar-user">
        <OrgSwitcher />
        {user?.name && <span className="navbar-name">{user.name}</span>}
        <button type="button" className="btn" onClick={logout}>
          logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
