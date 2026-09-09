import { NavLink } from 'react-router-dom';
import { Logo } from './index';

const links = [
  { text: 'all jobs', path: 'all-jobs' },
  { text: 'add job', path: 'add-job' },
  { text: 'profile', path: 'profile' },
];

/**
 * Dashboard sidebar navigation (relative NavLinks inside /dashboard).
 */
const Sidebar = () => {
  return (
    <aside className="sidebar">
      <Logo />
      <ul className="nav-links">
        {links.map(({ text, path }) => (
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
