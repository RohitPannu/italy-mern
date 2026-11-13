import { useRef, useState } from 'react';
import PasswordField from './PasswordField.jsx';
import { authRequest, validateNewPassword } from './authApi.js';

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function StudentRecovery() {
  const resetMode = location.pathname.endsWith('/reset-password');
  const adminMode = location.pathname.startsWith('/admin/');
  const token = new URLSearchParams(location.search).get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState({ text: '', type: 'error' });
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [complete, setComplete] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (submitting.current || complete) return;
    if (!resetMode && !validEmail(email)) {
      setEmailError(email.trim() ? 'Enter a valid email address.' : 'Enter your email address.');
      return;
    }
    const nextErrors = {};
    if (resetMode) {
      const passwordError = validateNewPassword(password, '');
      if (passwordError) nextErrors.password = passwordError;
      if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage({ text: '', type: 'error' });
      return;
    }
    submitting.current = true;
    setLoading(true);
    setMessage({ text: '', type: 'error' });
    try {
      const data = resetMode
        ? await authRequest('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password, confirmPassword }) })
        : await authRequest('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setMessage({ text: data.message, type: 'success' });
      setComplete(true);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const invalidToken = resetMode && !/^[a-f\d]{64}$/i.test(token);
  return <main className="adm student-auth-page">
    <section className="card student-auth-card" aria-labelledby="recovery-title">
      <p className="student-auth-kicker">Study in Italy · {adminMode ? 'Admin portal' : 'Student portal'}</p>
      <h1 id="recovery-title">{resetMode ? 'Choose a new password' : 'Reset your password'}</h1>
      <p className="student-auth-intro">{resetMode ? `Set a new password for your ${adminMode ? 'admin' : 'student'} account.` : 'Enter your account email and we’ll send reset instructions if it matches an account.'}</p>
      {invalidToken ? <>
        <p className="student-auth-message error" role="alert">This reset link is invalid or incomplete.</p>
        <a href={adminMode ? '/admin/forgot-password' : '/student/forgot-password'}>Request a new reset link</a>
      </> : complete ? <>
        <p className="student-auth-message success" role="status">{message.text}</p>
        <a href={adminMode ? '/admin' : '/student'}>Return to log in</a>
      </> : <form className="student-auth-form" onSubmit={submit} noValidate>
        {!resetMode && <>
          <label htmlFor="recovery-email">Email address
            <input id="recovery-email" type="email" inputMode="email" autoComplete="email" placeholder="student@gmail.com" required value={email} onChange={event => { setEmail(event.target.value); if (emailError) setEmailError(''); }} onBlur={() => setEmailError(email && !validEmail(email) ? 'Enter a valid email address.' : '')} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'recovery-email-error' : 'recovery-email-help'} />
          </label>
          <small id={emailError ? 'recovery-email-error' : 'recovery-email-help'} className={emailError ? 'auth-field-error' : 'auth-field-help'}>{emailError || 'Personal and university email addresses are accepted.'}</small>
        </>}
        {resetMode && <>
          <PasswordField id="reset-password" name="password" label="New password" value={password} onChange={event => { setPassword(event.target.value); setFieldErrors(current => ({ ...current, password: '' })); }} autoComplete="new-password" minLength={10} required error={fieldErrors.password} />
          <small className="auth-field-help">At least 10 characters, including an uppercase letter and a number.</small>
          <PasswordField id="reset-confirm-password" name="confirmPassword" label="Confirm new password" value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setFieldErrors(current => ({ ...current, confirmPassword: '' })); }} autoComplete="new-password" minLength={10} required error={fieldErrors.confirmPassword} />
        </>}
        <button className="student-auth-submit" type="submit" disabled={loading || complete}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Please wait…' : resetMode ? 'Save new password' : 'Send reset link'}
        </button>
        <p className={`student-auth-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'} aria-live="polite">{message.text}</p>
      </form>}
      {!complete && <a className="student-auth-back" href={adminMode ? '/admin' : '/student'}>Back to log in</a>}
    </section>
  </main>;
}