const argon2 = require('argon2');
const commonPasswords = new Set(require('fs').readFileSync(require('path').join(__dirname, '../data/common-passwords.txt'), 'utf8').split(/\r?\n/).map(x => x.toLowerCase()).filter(Boolean));
const COMMON_PASSWORDS = commonPasswords;
const hashPassword = password => argon2.hash(password, { type: argon2.argon2id, memoryCost: 64 * 1024, iterations: 2, saltLength: 16 });
const verifyPassword = (password, hash) => argon2.verify(hash, password);
const passwordStrength = password => {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
};
const validatePassword = (password, email) => {
  if (password.length < 10) return 'Password must be at least 10 characters.';
  const emailName = String(email || '').split('@')[0].toLowerCase();
  if (emailName.length >= 3 && password.toLowerCase().includes(emailName)) return 'Password must not contain your email name.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Choose a stronger password that is not commonly used.';
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) return 'Password must include an uppercase letter and a number.';
  return null;
};
module.exports = { hashPassword, verifyPassword, validatePassword, passwordStrength };
