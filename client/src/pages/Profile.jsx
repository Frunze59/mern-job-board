import { useDashboardContext } from '../context/DashboardContext';

/**
 * /dashboard/profile - name and email of the signed-in user.
 * The details come from the copy saved at login; the API returns no other
 * profile fields.
 */
const Profile = () => {
  const { user } = useDashboardContext();

  if (!user) {
    return (
      <section>
        <h2>Profile</h2>
        <p>No profile details found. Please log in again.</p>
      </section>
    );
  }

  return (
    <section className="profile">
      <h2>Profile</h2>
      <dl className="profile-details">
        <dt>Name</dt>
        <dd>{user.name}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
      </dl>
    </section>
  );
};

export default Profile;
