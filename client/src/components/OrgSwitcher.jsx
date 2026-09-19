import { useDashboardContext } from '../context/DashboardContext';

/**
 * Chooses the active organization. Lives in the navbar because it applies to
 * every page, not just the one on screen.
 *
 * The role is shown next to each name so the user knows what they are allowed
 * to do before they try it: switching to an org where they are a viewer makes
 * the add/edit/delete buttons disappear, and the label is what explains why.
 *
 * Rendered even when there is only one org. A select with a single option is
 * slightly odd, but on a permission-based app "which org am I in?" should
 * always be answerable at a glance.
 */
const OrgSwitcher = () => {
  const { orgs, activeOrg, selectOrg } = useDashboardContext();

  if (orgs.length === 0) return null;

  return (
    <div className="org-switcher">
      <label className="org-switcher-label" htmlFor="active-org">
        org
      </label>
      <select
        id="active-org"
        name="active-org"
        className="form-select org-switcher-select"
        value={activeOrg?._id ?? ''}
        onChange={(event) => selectOrg(event.target.value)}
      >
        {orgs.map((org) => (
          <option key={org._id} value={org._id}>
            {org.name} ({org.role})
          </option>
        ))}
      </select>
    </div>
  );
};

export default OrgSwitcher;
