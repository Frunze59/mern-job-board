import { Link, useRouteError } from 'react-router-dom';

/**
 * 404 / error page with a way back home.
 */
const Error = () => {
  const error = useRouteError();

  if (error?.status === 404 || !error) {
    return (
      <main className="error-page">
        <h1>404</h1>
        <h3>Page not found</h3>
        <p>We can&apos;t find the page you&apos;re looking for.</p>
        <Link to="/" className="btn">
          back home
        </Link>
      </main>
    );
  }

  return (
    <main className="error-page">
      <h3>Something went wrong</h3>
      <p>An unexpected error occurred. Please try again.</p>
      <Link to="/" className="btn">
        back home
      </Link>
    </main>
  );
};

export default Error;
