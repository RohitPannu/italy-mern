import { useEffect, useRef, useState } from 'react';
import PasswordField from './PasswordField.jsx';
import { authRequest, getCurrentUser, validateNewPassword } from './authApi.js';
import { validExternalDestination } from './StudentAccessLink.jsx';

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function StudentAuth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [emailError, setEmailError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(() => new URLSearchParams(location.search).has('expired')
    ? { text: 'Your session expired. Please log in again.', type: 'error' }
    : { text: '', type: 'error' });
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const returnTo = validExternalDestination(new URLSearchParams(location.search).get('returnTo') || '');
  useEffect(() => {
    if (!returnTo) return;
    let active = true;
    getCurrentUser().then(data => {
      if (active && data.user?.role === 'student') window.location.replace(returnTo);
      else if (active) setMessage({ text: 'Use a student account to open the selected program or university page.', type: 'error' });
    }).catch(error => {
      if (active && error.status !== 401) setMessage({ text: error.message, type: 'error' });
    });
    return () => { active = false; };
  }, [returnTo]);
  const update = field => event => setForm(current => ({ ...current, [field]: event.target.value }));
  const chooseMode = nextMode => {
    setMode(nextMode);
    setMessage({ text: '', type: 'error' });
    setEmailError('');
    setFieldErrors({});
  };
  const validateEmail = () => {
    const error = !form.email.trim() ? 'Enter your email address.' : !validEmail(form.email) ? 'Enter a valid email address.' : '';
    setEmailError(error);
    return !error;
  };
  const submit = async event => {
    event.preventDefault();
    if (submitting.current || !validateEmail()) return;
    const nextErrors = {};
    if (mode === 'register') {
      if (form.name.trim().length < 2) nextErrors.name = 'Enter your full name.';
      const passwordError = validateNewPassword(form.password, form.email);
      if (passwordError) nextErrors.password = passwordError;
      if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    } else if (!form.password) nextErrors.password = 'Enter your password.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage({ text: '', type: 'error' });
      return;
    }
    submitting.current = true;
    setLoading(true);
    setMessage({ text: '', type: 'error' });
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await authRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ ...form, email: form.email.trim() })
      });
      if (mode === 'register') {
        chooseMode('login');
        setForm(current => ({ ...current, password: '', confirmPassword: '' }));
        setMessage({ text: 'Account created. You can now log in.', type: 'success' });
      } else if (data.user?.role !== 'student') {
        setMessage({ text: 'This portal is for student accounts.', type: 'error' });
      } else {
        window.location.assign(returnTo || '/student/dashboard');
      }
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return <main className="adm student-auth-page">
    <section className="card student-auth-card" aria-labelledby="student-auth-title">
      <p className="student-auth-kicker">Study in Italy</p>
      <h1 id="student-auth-title">Student portal</h1>
      <p className="student-auth-intro">{returnTo ? 'Log in or create a student account to securely access the program or university page you selected.' : 'Manage your study shortlist and application progress.'}</p>
      <div className="student-auth-tabs" role="group" aria-label="Account access">
        <button type="button" aria-pressed={mode === 'login'} disabled={loading} onClick={() => chooseMode('login')}>Log in</button>
        <button type="button" aria-pressed={mode === 'register'} disabled={loading} onClick={() => chooseMode('register')}>Create account</button>
      </div>
      <form className="student-auth-form" onSubmit={submit} noValidate>
        {mode === 'register' && <label htmlFor="student-name">Full name
          <input id="student-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={event => { update('name')(event); setFieldErrors(current => ({ ...current, name: '' })); }} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'student-name-error' : undefined} />
          {fieldErrors.name && <small id="student-name-error" className="auth-field-error">{fieldErrors.name}</small>}
        </label>}
        <label htmlFor="student-email">Email address
          <input id="student-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="student@gmail.com" required value={form.email} onChange={event => { update('email')(event); if (emailError) setEmailError(''); }} onBlur={validateEmail} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'student-email-error' : 'student-email-help'} />
        </label>
        <small id={emailError ? 'student-email-error' : 'student-email-help'} className={emailError ? 'auth-field-error' : 'auth-field-help'}>{emailError || 'Use your personal or university email address.'}</small>
        <PasswordField id="student-password" name="password" label="Password" value={form.password} onChange={event => { update('password')(event); setFieldErrors(current => ({ ...current, password: '' })); }} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 10 : 1} required error={fieldErrors.password} />
        {mode === 'register' && <>
          <small className="auth-field-help">At least 10 characters, including an uppercase letter and a number.</small>
          <PasswordField id="student-confirm-password" name="confirmPassword" label="Confirm password" value={form.confirmPassword} onChange={event => { update('confirmPassword')(event); setFieldErrors(current => ({ ...current, confirmPassword: '' })); }} autoComplete="new-password" minLength={10} required error={fieldErrors.confirmPassword} />
        </>}
        <div className="student-auth-links">
          {mode === 'login' ? <><a href="/student/forgot-password">Forgot password?</a><a href="/admin">Admin login</a></> : <span>Use an email address you can access.</span>}
          {mode === 'register' && <a href="/student">Already registered? Log in</a>}
        </div>
        <button className="student-auth-submit" type="submit" disabled={loading}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className={`student-auth-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'} aria-live="polite">{message.text}</p>
      </form>
    </section>
  </main>;
}
