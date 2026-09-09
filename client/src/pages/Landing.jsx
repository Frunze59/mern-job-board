import { Link } from 'react-router-dom';
import { Logo } from '../components';

/**
 * Public landing page: app name, a short description and a way in.
 */
const Landing = () => {
  return (
    <main className="landing">
      <Logo />
      <h1>
        Track every <span className="landing-highlight">job application</span>
      </h1>
      <p>
        Keep applications, interviews and rejections in one place. Add a role in
        seconds, then filter, search and sort your list to see exactly where
        things stand.
      </p>
      <Link to="/register" className="btn">
        Login / Register
      </Link>
    </main>
  );
};

export default Landing;
