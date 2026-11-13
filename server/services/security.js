const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config, random } = require('../config');
const { User, Session } = require('../models/auth');
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const randomToken = () => random(32).toString('hex');
const signAccess = user => jwt.sign({ sub: String(user._id), role: user.role, type: 'access', jti: randomToken() }, config.accessSecret, { expiresIn: '15m' });
const signRefresh = user => jwt.sign({ sub: String(user._id), role: user.role, type: 'refresh', jti: randomToken() }, config.refreshSecret, { expiresIn: '7d' });
const verifyToken = (token, secret) => jwt.verify(token, secret);
const setAuthCookies = (res, accessToken, refreshToken, csrfToken) => {
  const base = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', ...config.cookieOptions };
  res.cookie('accessToken', accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie('csrfToken', csrfToken, { ...base, maxAge: 15 * 60 * 1000 });
};
const clearAuthCookies = res => {
  const options = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', ...config.cookieOptions };
  res.clearCookie('accessToken', options); res.clearCookie('refreshToken', options); res.clearCookie('csrfToken', options);
};
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    if (!token || !refreshToken) return res.status(401).json({ error: 'Authentication required.' });
    const payload = verifyToken(token, config.accessSecret);
    const refreshPayload = verifyToken(refreshToken, config.refreshSecret);
    if (payload.type !== 'access' || refreshPayload.type !== 'refresh' || payload.sub !== refreshPayload.sub) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const session = await Session.findOne({
      userId: payload.sub,
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });
    if (!session) return res.status(401).json({ error: 'Authentication required.' });
    const user = await User.findById(payload.sub).select('-passwordHash -mfaSecretEnc -mfaRecoveryHashes');
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account unavailable.' });
    req.user = user; req.auth = payload; req.session = session; next();
  } catch { res.status(401).json({ error: 'Authentication required.' }); }
};
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied.' });
  next();
};
const requireCsrf = (req, res, next) => {
  const cookie = req.cookies.csrfToken;
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) return res.status(403).json({ error: 'CSRF validation failed.' });
  next();
};
module.exports = { hashToken, randomToken, signAccess, signRefresh, verifyToken, setAuthCookies, clearAuthCookies, requireAuth, requireRole, requireCsrf };
