import { Link } from 'react-router-dom';
import { Logo } from '../components';

/**
 * Public landing page: logo/app name, short description, "Login / Register" button.
 */
const Landing = () => {
  return (
    <main className="landing">
      <Logo />
      <h1>Job Board</h1>
      <p>{/* TODO: short description of the app */}Track your job applications in one place.</p>
      <Link to="/register" className="btn">
        Login / Register
      </Link>
    </main>
  );
};

export default Landing;
