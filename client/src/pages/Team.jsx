import { useDashboardContext } from '../context/DashboardContext';
import { CreateOrgForm, InviteForm, MembersList } from '../components';

/**
 * /dashboard/team
 *
 * Three things, all about the active organization, each with its own rule:
 *  - the members list, which every member may read
 *  - the invite form, owners only
 *  - the create-organization form, open to anyone
 *
 * activeOrg is never null here: DashboardLayout does not render a page until
 * it has one.
 */
const Team = () => {
  const { activeOrg, user, refreshOrgs } = useDashboardContext();
  const isOwner = activeOrg.role === 'owner';

  return (
    <section className="team-page">
      <h2>Team</h2>
      <p className="page-subtitle">
        {activeOrg.name} &middot; you are {isOwner ? 'an' : 'a'} {activeOrg.role}
      </p>

      <MembersList orgId={activeOrg._id} currentEmail={user?.email} />

      {/* A Personal workspace belongs to one account and is what every job
          created before v2 was migrated into. Inviting people into something
          called "Personal" would be the wrong shape, so the page points at the
          create form instead of offering an invite form that would work but
          leave a confusing org name behind. */}
      {activeOrg.isPersonal && (
        <p className="notice">
          This is your personal workspace. Create an organization below to work with
          other people.
        </p>
      )}

      {!activeOrg.isPersonal && isOwner && <InviteForm orgId={activeOrg._id} />}

      {/* Said out loud rather than leaving a recruiter or viewer wondering
          where the invite form went. */}
      {!activeOrg.isPersonal && !isOwner && (
        <p className="notice">
          Only an owner of {activeOrg.name} can invite new members.
        </p>
      )}

      <CreateOrgForm onCreated={(orgId) => refreshOrgs(orgId)} />
    </section>
  );
};

export default Team;
