import { useEffect, useState } from 'react';
import customFetch, { getErrorMessage } from '../utils/customFetch';
import formatDate from '../utils/formatDate';

/**
 * Everyone who has accepted a place in this organization.
 *
 * The org is named in the URL rather than carried in X-Org-Id, because that
 * is how the endpoint is built: it checks the caller's membership in the org
 * it was asked about. The two agree here anyway, since the page only ever
 * asks about the active org.
 *
 * Any member may read this list, including a viewer. Knowing who else is on
 * the team is not a write.
 *
 * "You" is found by email rather than by id, because the login response
 * carries only { name, email } and that is all the client has stored. It is an
 * exact comparison rather than a loose one: the User schema lowercases and
 * trims the address, so both sides are the same normalised string.
 */
const MembersList = ({ orgId, currentEmail }) => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Ignore a response that arrives after the org changed underneath us.
    let cancelled = false;

    const loadMembers = async () => {
      try {
        const { data } = await customFetch.get(`/orgs/${orgId}/members`);
        if (!cancelled) setMembers(data.members ?? []);
      } catch (requestError) {
        if (!cancelled) setError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (isLoading) return <p className="empty-state">Loading members...</p>;

  if (error) {
    return (
      <p className="alert alert-danger" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.userId}>
              <td>
                {member.name}
                {member.email === currentEmail && <span className="tag">you</span>}
              </td>
              <td>{member.email}</td>
              <td>
                <span className={`role role-${member.role}`}>{member.role}</span>
              </td>
              <td>{formatDate(member.joinedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MembersList;
