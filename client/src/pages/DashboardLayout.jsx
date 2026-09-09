import { Outlet } from 'react-router-dom';
import { Navbar, Sidebar } from '../components';
import { DashboardProvider } from '../context/DashboardContext';

/**
 * Nested layout route for /dashboard/*.
 * Shared navbar + sidebar; child pages render inside <Outlet />.
 */
const DashboardLayout = () => {
  return (
    <DashboardProvider>
      <section className="dashboard">
        <Sidebar />
        <div className="dashboard-main">
          <Navbar />
          <div className="dashboard-page">
            <Outlet />
          </div>
        </div>
      </section>
    </DashboardProvider>
  );
};

export default DashboardLayout;
