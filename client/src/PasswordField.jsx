import { useState } from 'react';

export default function PasswordField({ id, name, label, value, onChange, autoComplete, minLength, required, error = '' }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-password-field">
    <label htmlFor={id}>{label}</label>
    <span className="auth-password-control">
      <input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} maxLength={128} required={required} value={value} onChange={onChange} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      <button type="button" className="auth-password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? 'Hide' : 'Show'}</button>
    </span>
    {error && <small id={`${id}-error`} className="auth-field-error">{error}</small>}
  </div>;
}