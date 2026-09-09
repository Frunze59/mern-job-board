import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import {
  Landing,
  Register,
  DashboardLayout,
  AllJobs,
  AddJob,
  EditJob,
  Profile,
  Error,
  ProtectedRoute,
} from './pages';

/**
 * Route map (see task spec):
 *
 *  /                       Landing (public)
 *  /register               Register / Login toggle (public)
 *  /dashboard              -> redirect to /dashboard/all-jobs
 *  /dashboard/all-jobs     job list + filters + pagination
 *  /dashboard/add-job      create job
 *  /dashboard/edit-job/:id edit job (same form as add)
 *  /dashboard/profile      logged-in user info
 *  *                       404
 *
 * /dashboard/* is wrapped in <ProtectedRoute> which redirects to /register when no token.
 */
const router = createBrowserRouter([
  { path: '/', element: <Landing />, errorElement: <Error /> },
  { path: '/register', element: <Register /> },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="all-jobs" replace /> },
      { path: 'all-jobs', element: <AllJobs /> },
      { path: 'add-job', element: <AddJob /> },
      { path: 'edit-job/:id', element: <EditJob /> },
      { path: 'profile', element: <Profile /> },
    ],
  },
  { path: '*', element: <Error /> },
]);

const App = () => <RouterProvider router={router} />;

export default App;
