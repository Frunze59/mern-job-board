import { Link, useRouteError } from 'react-router-dom';

/**
 * 404 / error page with a back-to-home link.
 */
const Error = () => {
  const error = useRouteError();

  if (error?.status === 404 || !error) {
    return (
      <main className="error-page">
        <h1>404</h1>
        <h3>Page not found</h3>
        <p>We can't seem to find the page you're looking for.</p>
        <Link to="/">back home</Link>
      </main>
    );
  }

  return (
    <main className="error-page">
      <h3>Something went wrong</h3>
      <Link to="/">back home</Link>
    </main>
  );
};

export default Error;
