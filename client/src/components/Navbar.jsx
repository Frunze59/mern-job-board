// import { useDashboardContext } from '../context/DashboardContext';

/**
 * Top bar of the dashboard: page title, user name, logout button.
 * TODO: wire logout from DashboardContext.
 */
const Navbar = () => {
  return (
    <nav className="navbar">
      <h4>Dashboard</h4>
      <button type="button" className="btn">
        logout
      </button>
    </nav>
  );
};

export default Navbar;
