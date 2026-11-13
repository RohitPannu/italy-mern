require('dotenv').config();
const crypto = require('crypto');
const requiredSecrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'TOKEN_ENC_KEY'];
for (const key of requiredSecrets) {
  const value = process.env[key];
  const environment = process.env.NODE_ENV === 'production' ? ' in production' : '';
  if (!value || value.length < 32) throw new Error(`${key} must be set to at least 32 characters${environment}.`);
}
if (new Set(requiredSecrets.map(key => process.env[key])).size !== requiredSecrets.length) {
  throw new Error('JWT and token-encryption secrets must use unique values.');
}
if (process.env.NODE_ENV === 'production') {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be set in production.');
  if (!process.env.ALLOWED_ORIGINS || !process.env.ALLOWED_ORIGINS.trim()) throw new Error('ALLOWED_ORIGINS must be set in production.');
  const origins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  if (origins.some(origin => {
    try {
      const url = new URL(origin);
      return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
    } catch {
      return true;
    }
  })) throw new Error('ALLOWED_ORIGINS must contain comma-separated HTTP or HTTPS origins.');
  let clientUrl;
  try { clientUrl = new URL(process.env.CLIENT_URL); } catch {}
  if (!clientUrl || !['http:', 'https:'].includes(clientUrl.protocol)) throw new Error('CLIENT_URL must be a valid HTTP or HTTPS URL in production.');
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) {
    if (!process.env[key]) throw new Error(`${key} must be set in production to enable password recovery email.`);
  }
}
const config = {
  port: Number(process.env.PORT || 5005),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/italy',
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  tokenEncKey: process.env.TOKEN_ENC_KEY,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(x => x.trim()),
  cookieDomain: process.env.COOKIE_DOMAIN,
  smtp: { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.MAIL_FROM || 'no-reply@localhost' },
  nodeEnv: process.env.NODE_ENV || 'development'
};
const cookieOptions = config.cookieDomain ? { domain: config.cookieDomain } : {};
config.cookieOptions = cookieOptions;
const random = bytes => crypto.randomBytes(bytes);
module.exports = { config, random };
