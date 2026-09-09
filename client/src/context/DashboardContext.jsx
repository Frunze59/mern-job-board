import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKEN_KEY, USER_KEY } from '../utils/customFetch';

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

const DashboardContext = createContext(null);

/**
 * Shared dashboard state: the current user and an explicit logout.
 */
export const DashboardProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    // replace so the back button cannot return to a dashboard page that would
    // immediately bounce to /register anyway.
    navigate('/', { replace: true });
  }, [navigate]);

  // Memoised so consumers do not re-render on every provider render.
  const value = useMemo(() => ({ user, logout }), [user, logout]);

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
