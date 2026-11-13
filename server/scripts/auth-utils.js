const normalizeEmail = email => String(email || '').trim().toLowerCase();
const validateRegistration = ({ name = '', email = '', password = '', confirmPassword = '' }) => {
  const errors = [];
  if (!String(name).trim()) errors.push('Enter your full name.');
  if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) errors.push('Enter a valid email address.');
  if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password))) errors.push('Use at least 8 characters with a number and uppercase letter.');
  if (String(password) !== String(confirmPassword)) errors.push('Passwords do not match.');
  return { valid: errors.length === 0, errors };
};
const createTokenPayload = (id, role) => ({ sub: String(id), role });
module.exports = { normalizeEmail, validateRegistration, createTokenPayload };
