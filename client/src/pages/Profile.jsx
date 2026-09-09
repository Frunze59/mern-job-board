// import { useDashboardContext } from '../context/DashboardContext';

/**
 * /dashboard/profile - show name and email of the logged-in user.
 *
 * TODO: read user from context (stored in localStorage at login/register).
 */
const Profile = () => {
  return (
    <section>
      <h2>Profile</h2>
      <p>Name: {/* user.name */}</p>
      <p>Email: {/* user.email */}</p>
    </section>
  );
};

export default Profile;
