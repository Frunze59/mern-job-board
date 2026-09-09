import { Navigate } from 'react-router-dom';

/**
 * Wraps /dashboard/*. Redirects to /register when no JWT is stored.
 */
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/register" replace />;
  }
  return children;
};

export default ProtectedRoute;
