import { useEffect, useState } from 'react';
import { authRequest } from './authApi.js';

export default function StudentVerification() {
  const token = new URLSearchParams(location.search).get('token') || '';
  const [state, setState] = useState({ loading: true, message: '' });
  useEffect(() => {
    let active = true;
    if (!token) {
      setState({ loading: false, message: 'This verification link is invalid or incomplete.' });
      return () => { active = false; };
    }
    authRequest('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(data => { if (active) setState({ loading: false, message: data.message }); })
      .catch(error => { if (active) setState({ loading: false, message: error.message }); });
    return () => { active = false; };
  }, [token]);

  return <main className="adm student-auth-page"><section className="card student-auth-card" aria-labelledby="verification-title">
    <p className="student-auth-kicker">Study in Italy</p>
    <h1 id="verification-title">Verify your email</h1>
    <p className="student-auth-intro" role={state.loading ? 'status' : 'alert'} aria-live="polite">{state.loading ? 'Checking your verification link…' : state.message}</p>
    {!state.loading && <a className="student-auth-back" href="/student">Continue to log in</a>}
  </section></main>;
}