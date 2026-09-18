import { NavLink } from 'react-router-dom';
import { Logo } from './index';
import { useDashboardContext } from '../context/DashboardContext';

// Stats is built in step 32. Its route exists and the API behind it is
// finished, but the page is still a placeholder, so it is not advertised here
// until it renders something real.
//
// `writeOnly` links are hidden for a viewer: the page behind them only offers
// an action the server would refuse. Team is not one of them -- a viewer may
// read the members list, and may create an organization of their own.
const links = [
  { text: 'all jobs', path: 'all-jobs' },
  { text: 'add job', path: 'add-job', writeOnly: true },
  { text: 'team', path: 'team' },
  { text: 'profile', path: 'profile' },
];

/**
 * Dashboard sidebar navigation (relative NavLinks inside /dashboard).
 */
const Sidebar = () => {
  const { canWrite } = useDashboardContext();
  const visible = links.filter((link) => canWrite || !link.writeOnly);

  return (
    <aside className="sidebar">
      <Logo />
      <ul className="nav-links">
        {visible.map(({ text, path }) => (
          <li key={path}>
            <NavLink to={path} className="nav-link" end>
              {text}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
