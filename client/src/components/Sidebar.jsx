import { NavLink } from 'react-router-dom';
import { Logo } from './index';
import { useDashboardContext } from '../context/DashboardContext';

// Stats and Team are built in steps 32 and 30. Their routes exist and the
// API behind them is finished, but the pages are still placeholders, so they
// are not advertised here until they render something real.
//
// `writeOnly` links are hidden for a viewer: the page behind them only offers
// an action the server would refuse.
const links = [
  { text: 'all jobs', path: 'all-jobs' },
  { text: 'add job', path: 'add-job', writeOnly: true },
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
