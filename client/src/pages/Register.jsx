// import { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import customFetch from '../utils/customFetch';
// import { FormRow, Logo } from '../components';

/**
 * Register / Login page.
 *
 * TODO:
 *  - local state: { name, email, password, isMember: true }
 *  - toggle between Register and Login forms (isMember)
 *  - on submit:
 *      isMember ? POST /auth/login : POST /auth/register
 *  - on success: localStorage.setItem('token', data.token) (+ user), navigate('/dashboard')
 *  - on error: show inline message from error.response.data.msg
 *  - if a token already exists, redirect to /dashboard
 */
const Register = () => {
  return (
    <main className="form-page">
      <form className="form">
        <h3>{/* TODO: isMember ? 'Login' : 'Register' */}Login</h3>
        {/* TODO: FormRow name (register only), email, password */}
        <button type="submit" className="btn btn-block">
          submit
        </button>
        <p>
          {/* TODO: "Not a member yet?" / "Already a member?" toggle */}
        </p>
      </form>
    </main>
  );
};

export default Register;
