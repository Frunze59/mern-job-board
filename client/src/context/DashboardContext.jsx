import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import customFetch, { getErrorMessage, TOKEN_KEY, USER_KEY } from '../utils/customFetch';
import { ACTIVE_ORG_KEY, WRITE_ROLES } from '../utils/constants';

/**
 * Read the signed-in user saved at login. A malformed entry (hand-edited or
 * left over from an older version) must not crash the dashboard, so treat it
 * as "no user" instead of letting JSON.parse throw during render.
 */
const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Decide which org to start in.
 *
 * The stored id is only honoured when it is still in the list the server just
 * returned. That is what handles a membership revoked while the user was away,
 * and an id left over from a different account on a shared browser: instead of
 * every request failing with a 403, the user quietly lands in their Personal
 * org.
 */
const chooseActiveOrg = (orgs, storedId) =>
  orgs.find((org) => org._id === storedId) ??
  orgs.find((org) => org.isPersonal) ??
  orgs[0] ??
  null;

const DashboardContext = createContext(null);

/**
 * Shared dashboard state: the signed-in user, the organizations they belong
 * to, which one is active, and what they are allowed to do in it.
 *
 * The active org is held in two places on purpose: React state, which the UI
 * renders from, and localStorage, which the axios interceptor reads. Storage
 * is always written first, so a request can never carry a different org from
 * the one on screen.
 */
export const DashboardProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [orgs, setOrgs] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState('');
  const navigate = useNavigate();

  /**
   * Load the org list and settle on an active org.
   *
   * Also called by the Team page after creating an org or accepting an
   * invite, so the switcher picks up the new membership without a reload.
   * `preferId` lets the caller jump straight into the org just created.
   */
  const refreshOrgs = useCallback(async (preferId) => {
    setOrgsError('');
    try {
      const { data } = await customFetch.get('/orgs');
      const nextOrgs = data.orgs ?? [];
      const stored = preferId ?? localStorage.getItem(ACTIVE_ORG_KEY);
      const next = chooseActiveOrg(nextOrgs, stored);

      if (next) {
        localStorage.setItem(ACTIVE_ORG_KEY, next._id);
      } else {
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
      setOrgs(nextOrgs);
      setActiveOrg(next);
      return nextOrgs;
    } catch (error) {
      // A 401 is already being handled by the interceptor, which is about to
      // redirect; anything else is worth showing rather than swallowing.
      setOrgsError(getErrorMessage(error));
      return [];
    } finally {
      setIsLoadingOrgs(false);
    }
  }, []);

  // Runs once per mount of the dashboard. Synchronising with the server is
  // what an effect is for; the loading flag it clears is part of that update.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    refreshOrgs();
  }, [refreshOrgs]);

  /**
   * Switch orgs. Storage first, then state, for the reason given above.
   * An unknown id is ignored rather than clearing the active org.
   */
  const selectOrg = useCallback(
    (orgId) => {
      const next = orgs.find((org) => org._id === orgId);
      if (!next || next._id === activeOrg?._id) return;
      localStorage.setItem(ACTIVE_ORG_KEY, next._id);
      setActiveOrg(next);
    },
    [orgs, activeOrg]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACTIVE_ORG_KEY);
    setUser(null);
    // replace so the back button cannot return to a dashboard page that would
    // immediately bounce to /register anyway.
    navigate('/', { replace: true });
  }, [navigate]);

  /**
   * Whether the active role may create, edit or delete jobs.
   *
   * This only hides buttons. The server checks the same thing on every write,
   * so a viewer who calls the API directly is still refused; nothing here is
   * relied on for security.
   */
  const canWrite = WRITE_ROLES.includes(activeOrg?.role);

  // Memoised so consumers do not re-render on every provider render.
  const value = useMemo(
    () => ({
      user,
      logout,
      orgs,
      activeOrg,
      selectOrg,
      refreshOrgs,
      isLoadingOrgs,
      orgsError,
      canWrite,
    }),
    [user, logout, orgs, activeOrg, selectOrg, refreshOrgs, isLoadingOrgs, orgsError, canWrite]
  );

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
};

// The hook lives next to the provider it belongs to. Fast Refresh prefers a
// file to export only components, which is a dev-tooling preference rather
// than a correctness issue.
// eslint-disable-next-line react/only-export-components
export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used inside a DashboardProvider');
  }
  return context;
};
