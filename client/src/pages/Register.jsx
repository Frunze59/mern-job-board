import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import customFetch, {
  getErrorMessage,
  TOKEN_KEY,
  USER_KEY,
} from '../utils/customFetch';
import { FormRow, Logo } from '../components';

const emptyForm = { name: '', email: '', password: '' };

/**
 * Register / Login page.
 *
 * One form serves both modes. `isMember` decides which endpoint is called and
 * whether the name field is shown. On success the token and user are stored and
 * the user is sent to the dashboard.
 */
const Register = () => {
  const [values, setValues] = useState(emptyForm);
  const [isMember, setIsMember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Someone already signed in has no reason to see this page.
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const toggleMember = () => {
    setIsMember((previous) => !previous);
    setValues(emptyForm);
    setError('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { name, email, password } = values;

    if (!email || !password || (!isMember && !name)) {
      setError('Please fill out all fields');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { data } = await customFetch.post(
        isMember ? '/auth/login' : '/auth/register',
        isMember ? { email, password } : { name, email, password }
      );

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      // replace: true so the back button does not return to this form.
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      // The axios interceptor deliberately does not redirect on /auth 401s,
      // so the server's message can be shown here instead.
      setError(getErrorMessage(requestError));
      setIsLoading(false);
    }
  };

  return (
    <main className="form-page">
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-logo">
          <Logo />
        </div>
        <h3>{isMember ? 'Login' : 'Register'}</h3>

        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}

        {!isMember && (
          <FormRow
            type="text"
            name="name"
            value={values.name}
            onChange={handleChange}
            autoComplete="name"
          />
        )}
        <FormRow
          type="email"
          name="email"
          value={values.email}
          onChange={handleChange}
          autoComplete="email"
        />
        <FormRow
          type="password"
          name="password"
          value={values.password}
          onChange={handleChange}
          autoComplete={isMember ? 'current-password' : 'new-password'}
        />

        <button type="submit" className="btn btn-block" disabled={isLoading}>
          {isLoading ? 'loading...' : 'submit'}
        </button>

        <p className="form-hint">
          {isMember ? 'Not a member yet?' : 'Already a member?'}
          <button type="button" className="btn-link" onClick={toggleMember}>
            {isMember ? 'Register' : 'Login'}
          </button>
        </p>
        <p className="form-hint">
          <Link to="/">back home</Link>
        </p>
      </form>
    </main>
  );
};

export default Register;
