import { NavLink } from 'react-router-dom';
import { Logo } from './index';
import { useDashboardContext } from '../context/DashboardContext';

// `writeOnly` links are hidden for a viewer: the page behind them only offers
// an action the server would refuse. Team and stats are not among them -- a
// viewer may read the members list and the numbers, and may create an
// organization of their own.
const links = [
  { text: 'all jobs', path: 'all-jobs' },
  { text: 'add job', path: 'add-job', writeOnly: true },
  { text: 'stats', path: 'stats' },
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
