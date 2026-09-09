import { createContext, useContext, useState } from 'react';
// import { useNavigate } from 'react-router-dom';

/**
 * Shared dashboard state: current user + logout.
 *
 * TODO:
 *  - read user from localStorage ('user') on init
 *  - logout(): remove token + user from localStorage, navigate('/')
 */
const DashboardContext = createContext(null);

export const DashboardProvider = ({ children }) => {
  const [user] = useState(() => {
    // TODO: JSON.parse(localStorage.getItem('user'))
    return null;
  });

  const logout = () => {
    // TODO
  };

  return (
    <DashboardContext.Provider value={{ user, logout }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboardContext = () => useContext(DashboardContext);
