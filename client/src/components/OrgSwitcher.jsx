// import { useDashboardContext } from '../context/DashboardContext';

/**
 * Select showing every org the user belongs to; changing it sets the active
 * org in context + localStorage, which the axios interceptor then sends as
 * X-Org-Id on every request. Lives in the navbar.
 *
 * TODO: implement; show "(role)" next to each name so the user knows what
 * they can do before they try.
 */
const OrgSwitcher = () => {
  return null;
};

export default OrgSwitcher;
