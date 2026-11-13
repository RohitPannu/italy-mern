require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const { body, validationResult } = require('express-validator');
const { config, random } = require('./config');
const { Program, University, Region, Scholarship, Announcement, Lead } = require('./models');
const { User, Session, AuthToken, AuditLog, Shortlist, Checklist } = require('./models/auth');
const { hashPassword, verifyPassword, validatePassword } = require('./services/password');
const { sendEmail } = require('./services/email');
const { parseCsv } = require('./scripts/audit');
const { validateImport } = require('./scripts/csv-import');
const { hashToken, randomToken, signAccess, signRefresh, verifyToken, setAuthCookies, clearAuthCookies, requireAuth, requireRole, requireCsrf } = require('./services/security');

const app = express();
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use((req, res, next) => {
  mongoSanitize(req.body);
  mongoSanitize(req.params);
  mongoSanitize(req.query);
  next();
});
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: true, legacyHeaders: false }));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } });
const recoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many recovery attempts. Please try again later.' } });
app.locals.authLimiters = { login: loginLimiter, recovery: recoveryLimiter };

const emailValidator = body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email address.');
const passwordValidator = body('password').isString().isLength({ min: 10, max: 128 }).withMessage('Password must be between 10 and 128 characters.');
const registerValidators = [body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'), emailValidator, passwordValidator, body('confirmPassword').custom((v, { req }) => v === req.body.password).withMessage('Passwords do not match.')];
const loginValidators = [emailValidator, body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Enter a valid email and password.')];
const requireCsrfForMutation = (req, res, next) => {
  const token = req.cookies.csrfToken;
  const supplied = req.get('x-csrf-token');
  const tokenBytes = token && Buffer.from(token);
  const suppliedBytes = supplied && Buffer.from(supplied);
  if (!tokenBytes || !suppliedBytes || tokenBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(tokenBytes, suppliedBytes)) return res.status(403).json({ error: 'CSRF validation failed.' });
  next();
};

const audit = async (actorId, action, targetId, req) => AuditLog.create({ actorId, action, targetId, ip: req.ip, userAgent: req.get('user-agent'), createdAt: new Date() });
const createAuthTokens = async (user, req, res) => {
  const accessToken = signAccess(user), refreshToken = signRefresh(user);
  const refreshHash = hashToken(refreshToken);
  const csrfTokenValue = randomToken();
  await Session.create({ userId: user._id, tokenHash: refreshHash, userAgent: req.get('user-agent') || '', ip: req.ip, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  setAuthCookies(res, accessToken, refreshToken, csrfTokenValue);
  res.cookie('csrfToken', csrfTokenValue, { httpOnly: false, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000, ...config.cookieOptions });
  return { accessToken, refreshToken, csrfToken: csrfTokenValue };
};

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'italy-mern-auth' }));
app.get('/api/programs', async (req, res, next) => {
  try {
    const { q, level, university, dept, region } = req.query;
    const filter = {};
    if (level) filter.level = String(level);
    if (university) filter.university = String(university);
    if (dept) filter.dept = String(dept);
    if (region) {
      const regionNames = await University.find({ region: String(region) }).distinct('name');
      filter.university = { $in: regionNames };
    }
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ course: rx }, { dept: rx }, { university: rx }];
    }
    const programs = await Program.find(filter).sort({ course: 1 }).limit(2000).lean();
    res.json(programs);
  } catch (err) { next(err); }
});
app.get('/api/meta', async (_req, res, next) => {
  try {
    const [unis, regions] = await Promise.all([
      University.find().sort({ region: 1, name: 1 }).lean(),
      Region.find().sort({ name: 1 }).lean()
    ]);
    res.json({ unis, regions });
  } catch (err) { next(err); }
});
app.get('/api/scholarships', async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const scholarships = await Scholarship.find({
      status: { $in: ['active', 'upcoming'] },
      $or: [{ deadline: '' }, { deadline: { $exists: false } }, { deadline: { $gte: today } }]
    }).sort({ applicationStart: 1, deadline: 1, title: 1 }).lean();
    res.json(scholarships);
  } catch (err) { next(err); }
});
app.get('/api/me/announcements', requireAuth, requireRole('student'), async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const announcements = await Announcement.find({
      published: true,
      $and: [
        { $or: [{ startsAt: '' }, { startsAt: { $exists: false } }, { startsAt: { $lte: today } }] },
        { $or: [{ endsAt: '' }, { endsAt: { $exists: false } }, { endsAt: { $gte: today } }] }
      ]
    }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(announcements);
  } catch (err) { next(err); }
});
app.post('/api/leads', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Name and a valid email are required.' });
    }
    await Lead.create({
      name,
      email,
      whatsapp: String(req.body?.whatsapp || '').trim(),
      message: String(req.body?.message || '').trim()
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.post('/api/auth/register', registerValidators, async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const email = req.body.email.toLowerCase();
    const passwordError = validatePassword(req.body.password, email);
    if (passwordError) return res.status(400).json({ error: passwordError });
    if (await User.exists({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = await User.create({ name: req.body.name.trim(), email, passwordHash: await hashPassword(req.body.password), role: 'student' });
    const token = randomToken();
    await AuthToken.create({ userId: user._id, type: 'verifyEmail', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const verifyUrl = `${config.clientUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await sendEmail({ to: email, subject: 'Verify your Study in Italy account', html: `<p>Hi ${user.name},</p><p>Verify your account with <a href="${verifyUrl}">this secure link</a>.</p>` });
    await audit(user._id, 'register', user._id, req);
    res.status(201).json({ user: { id: user._id, name: user.name, email, role: user.role, emailVerified: false } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    next(err);
  }
});
app.post('/api/auth/login', loginLimiter, loginValidators, async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    const isLocked = user?.lockUntil && user.lockUntil > Date.now();
    const valid = user && user.isActive && !isLocked && await verifyPassword(req.body.password, user.passwordHash || '');
    if (!valid) {
      if (user && !isLocked) {
        user.failedLogins += 1;
        if (user.failedLogins >= 5) user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        await audit(user._id, 'failed login', user._id, req);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date(); await user.save();
    await createAuthTokens(user, req, res);
    await audit(user._id, 'login', user._id, req);
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified } });
  } catch (err) { next(err); }
});
app.post('/api/auth/verify-email', body('token').isString().isLength({ min: 64, max: 64 }).isHexadecimal().withMessage('Invalid verification token.'), async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const hash = hashToken(req.body.token);
    const record = await AuthToken.findOneAndUpdate(
      { tokenHash: hash, type: 'verifyEmail', usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!record) return res.status(400).json({ error: 'Verification link is invalid or expired.' });
    const user = await User.findById(record.userId);
    if (!user) return res.status(400).json({ error: 'Verification link is invalid or expired.' });
    user.emailVerified = true; await user.save();
    await audit(user._id, 'verify email', user._id, req);
    res.json({ message: 'Email verified.' });
  } catch (err) { next(err); }
});
app.post('/api/auth/resend-verification', emailValidator, async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (user && !user.emailVerified) {
      const previous = await AuthToken.findOne({ userId: user._id, type: 'verifyEmail', usedAt: null });
      if (previous) await previous.deleteOne();
      const token = randomToken(); await AuthToken.create({ userId: user._id, type: 'verifyEmail', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      await sendEmail({ to: user.email, subject: 'Verify your account', html: `<p>Verify your account: ${config.clientUrl}/verify-email?token=${encodeURIComponent(token)}</p>` });
    }
    res.json({ message: 'If the account exists and is unverified, a verification email was sent.' });
  } catch (err) { next(err); }
});
app.post('/api/auth/forgot-password', recoveryLimiter, emailValidator, async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const user = await User.findOne({ email: req.body.email.trim().toLowerCase() });
    if (user) {
      await AuthToken.updateMany({ userId: user._id, type: 'resetPassword', usedAt: null }, { $set: { usedAt: new Date() } });
      const token = randomToken(); await AuthToken.create({ userId: user._id, type: 'resetPassword', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
      const resetPath = user.role === 'admin' || user.role === 'editor' ? '/admin/reset-password' : '/student/reset-password';
      void sendEmail({ to: user.email, subject: 'Reset your password', html: `<p>Reset your password: <a href="${config.clientUrl}${resetPath}?token=${encodeURIComponent(token)}">Continue</a></p>` })
        .catch(error => console.error('Password recovery email delivery failed:', error.name || 'Error'));
    }
    res.json({ message: 'If that account exists, a reset link has been sent.' });
  } catch (err) { next(err); }
});
app.post('/api/auth/reset-password', recoveryLimiter, body('token').isString().isLength({ min: 64, max: 64 }).isHexadecimal(), body('password').isString().isLength({ min: 10, max: 128 }), body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'), async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const record = await AuthToken.findOne({ tokenHash: hashToken(req.body.token), type: 'resetPassword', usedAt: null, expiresAt: { $gt: new Date() } });
    if (!record) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    const user = await User.findById(record.userId).select('+passwordHash');
    if (!user || !user.isActive) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    const passwordError = validatePassword(req.body.password, user.email);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const passwordHash = await hashPassword(req.body.password);
    const consumed = await AuthToken.findOneAndUpdate(
      { _id: record._id, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!consumed) return res.status(400).json({ error: 'Reset link is invalid or expired.' });
    user.passwordHash = passwordHash; await user.save();
    await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await audit(user._id, 'password change', user._id, req);
    res.json({ message: 'Password reset. Please sign in again.' });
  } catch (err) { next(err); }
});
app.post('/api/auth/refresh', (req, res, next) => {
  if (!req.cookies.refreshToken) return res.status(401).json({ error: 'Authentication required.' });
  requireCsrfForMutation(req, res, next);
}, async (req, res, next) => {
  try {
    const refresh = req.cookies.refreshToken; if (!refresh) return res.status(401).json({ error: 'Refresh required.' });
    const payload = verifyToken(refresh, config.refreshSecret); const hash = hashToken(refresh);
    const session = await Session.findOne({ tokenHash: hash, userId: payload.sub, revokedAt: null, expiresAt: { $gt: Date.now() } });
    if (!session) return res.status(401).json({ error: 'Session invalid or revoked.' });
    const user = await User.findById(payload.sub); if (!user || !user.isActive) return res.status(401).json({ error: 'Session invalid.' });
    const rotated = signRefresh(user); const newHash = hashToken(rotated);
    const replacement = await Session.create({ userId: user._id, tokenHash: newHash, userAgent: req.get('user-agent') || '', ip: req.ip, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    session.revokedAt = new Date(); session.replacedBy = replacement._id; await session.save();
    const token = signAccess(user); const csrfTokenValue = randomToken(); setAuthCookies(res, token, rotated, csrfTokenValue); res.cookie('csrfToken', csrfTokenValue, { httpOnly: false, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000, ...config.cookieOptions });
    await audit(user._id, 'refresh session', user._id, req);
    res.json({ user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) { next(err); }
});
app.post('/api/auth/logout', requireCsrfForMutation, async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const payload = verifyToken(refreshToken, config.refreshSecret);
        await Session.updateOne({ userId: payload.sub, tokenHash: hashToken(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } });
      } catch {}
    }
    clearAuthCookies(res);
    res.json({ message: 'Signed out.' });
  } catch (err) { next(err); }
});
app.post('/api/auth/logout-all', requireAuth, requireCsrfForMutation, async (req, res, next) => {
  try { await Session.updateMany({ userId: req.user._id, revokedAt: null }, { revokedAt: new Date() }); await audit(req.user._id, 'logout', req.user._id, req); clearAuthCookies(res); res.json({ message: 'All devices signed out.' }); } catch (err) { next(err); }
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role, emailVerified: req.user.emailVerified, mfaEnabled: req.user.mfaEnabled } }));
app.patch('/api/auth/me', requireAuth, requireCsrfForMutation, body('name').optional().trim().isLength({ min: 2, max: 100 }), async (req, res, next) => {
  try { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg }); if (req.body.name) req.user.name = req.body.name; await req.user.save(); await audit(req.user._id, 'profile update', req.user._id, req); res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } }); } catch (err) { next(err); }
});
app.post('/api/auth/change-password', requireAuth, requireCsrfForMutation, body('currentPassword').notEmpty(), body('newPassword').isString().isLength({ min: 10, max: 128 }), async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user || !(await verifyPassword(req.body.currentPassword, user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect.' });
    const passwordError = validatePassword(req.body.newPassword, user.email);
    if (passwordError) return res.status(400).json({ error: passwordError });
    user.passwordHash = await hashPassword(req.body.newPassword); await user.save();
    await Session.updateMany({ userId: req.user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await audit(req.user._id, 'password change', req.user._id, req); clearAuthCookies(res); res.json({ message: 'Password changed. Please sign in again.' });
  } catch (err) { next(err); }
});
app.get('/api/me/shortlist', requireAuth, requireRole('student'), async (req, res, next) => { try { const item = await Shortlist.findOne({ userId: req.user._id }).lean(); res.json({ programIds: item?.programIds || [] }); } catch (err) { next(err); } });
app.put('/api/me/shortlist', requireAuth, requireRole('student'), requireCsrfForMutation, body('programIds').isArray({ min: 0 }), async (req, res, next) => { try { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg }); const item = await Shortlist.findOneAndUpdate({ userId: req.user._id }, { $set: { programIds: req.body.programIds, updatedAt: new Date() } }, { upsert: true, new: true }).lean(); await audit(req.user._id, 'shortlist update', req.user._id, req); res.json({ programIds: item.programIds }); } catch (err) { next(err); } });
app.get('/api/me/checklist', requireAuth, requireRole('student'), async (req, res, next) => { try { const item = await Checklist.findOne({ userId: req.user._id }).lean(); res.json({ items: item?.items || [] }); } catch (err) { next(err); } });
app.put('/api/me/checklist', requireAuth, requireRole('student'), requireCsrfForMutation, body('items').isArray(), async (req, res, next) => { try { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg }); const item = await Checklist.findOneAndUpdate({ userId: req.user._id }, { $set: { items: req.body.items, updatedAt: new Date() } }, { upsert: true, new: true }).lean(); await audit(req.user._id, 'checklist update', req.user._id, req); res.json({ items: item.items }); } catch (err) { next(err); } });

app.use('/api/admin', requireAuth, requireRole('admin', 'editor'));
const scholarshipFields = [
  'title', 'provider', 'region', 'universities', 'description', 'benefits', 'applicationStart',
  'deadline', 'intake', 'eligibility', 'requirements', 'procedure', 'officialUrl', 'status', 'lastVerified'
];
const isDateOnly = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const normalizeScholarship = body => {
  const value = Object.fromEntries(scholarshipFields
    .filter(field => body[field] !== undefined)
    .map(field => [field, body[field]]));
  for (const field of ['title', 'provider', 'region', 'description']) {
    if (value[field] !== undefined) value[field] = String(value[field]).trim();
  }
  for (const field of ['benefits', 'intake', 'eligibility', 'officialUrl', 'applicationStart', 'deadline', 'lastVerified']) {
    if (value[field] !== undefined) value[field] = String(value[field] || '').trim();
  }
  for (const field of ['requirements', 'procedure']) {
    if (value[field] !== undefined) {
      if (!Array.isArray(value[field])) return { error: `${field} must be a list.` };
      value[field] = value[field].map(item => String(item).trim()).filter(Boolean);
    }
  }
  if (value.universities !== undefined) {
    if (!Array.isArray(value.universities)) return { error: 'Universities must be a list.' };
    value.universities = value.universities.map(item => ({
      name: String(item?.name || '').trim(),
      description: String(item?.description || '').trim()
    })).filter(item => item.name);
  }
  if (value.status !== undefined && !['active', 'upcoming', 'closed'].includes(value.status)) {
    return { error: 'Status must be active, upcoming, or closed.' };
  }
  for (const field of ['applicationStart', 'deadline', 'lastVerified']) {
    if (value[field] && !isDateOnly(value[field])) {
      return { error: `${field} must be a valid date in YYYY-MM-DD format.` };
    }
  }
  if (value.officialUrl && !/^https?:\/\/\S+$/i.test(value.officialUrl)) {
    return { error: 'Official link must be a valid HTTP or HTTPS URL.' };
  }
  return { value };
};
const validateScholarshipUniversities = async scholarship => {
  if (!scholarship.region || !Array.isArray(scholarship.universities) || !scholarship.universities.length) {
    return 'Choose a region and at least one university.';
  }
  const names = [...new Set(scholarship.universities.map(university => university.name))];
  if (names.length !== scholarship.universities.length) return 'Each university can only be selected once.';
  const count = await University.countDocuments({ name: { $in: names }, region: scholarship.region });
  return count === names.length ? '' : 'Select universities that belong to the chosen region.';
};
app.get('/api/admin/scholarships', async (_req, res, next) => {
  try { res.json(await Scholarship.find().sort({ updatedAt: -1 }).lean()); } catch (err) { next(err); }
});
app.post('/api/admin/scholarships', requireCsrfForMutation, async (req, res, next) => {
  try {
    const { value, error } = normalizeScholarship(req.body);
    if (error) return res.status(400).json({ error });
    if (!value.title || !value.provider || !value.description) return res.status(400).json({ error: 'Title, provider, and description are required.' });
    const universityError = await validateScholarshipUniversities(value);
    if (universityError) return res.status(400).json({ error: universityError });
    const scholarship = await Scholarship.create(value);
    await audit(req.user._id, 'create scholarship', scholarship._id, req);
    res.status(201).json(scholarship);
  } catch (err) { next(err); }
});
app.put('/api/admin/scholarships/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const { value, error } = normalizeScholarship(req.body);
    if (error) return res.status(400).json({ error });
    if (value.title !== undefined && !value.title) return res.status(400).json({ error: 'Title is required.' });
    if (value.provider !== undefined && !value.provider) return res.status(400).json({ error: 'Provider is required.' });
    if (value.description !== undefined && !value.description) return res.status(400).json({ error: 'Description is required.' });
    const current = await Scholarship.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: 'Scholarship not found.' });
    const universityError = await validateScholarshipUniversities({
      region: value.region ?? current.region,
      universities: value.universities ?? current.universities
    });
    if (universityError) return res.status(400).json({ error: universityError });
    const scholarship = await Scholarship.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    await audit(req.user._id, 'update scholarship', scholarship._id, req);
    res.json(scholarship);
  } catch (err) { next(err); }
});
app.delete('/api/admin/scholarships/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const scholarship = await Scholarship.findByIdAndDelete(req.params.id);
    if (!scholarship) return res.status(404).json({ error: 'Scholarship not found.' });
    await audit(req.user._id, 'delete scholarship', scholarship._id, req);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.get('/api/admin/users', requireRole('admin'), async (req, res, next) => { try { res.json(await User.find().select('-passwordHash -mfaSecretEnc -mfaRecoveryHashes').sort({ createdAt: -1 }).lean()); } catch (err) { next(err); } });
app.get('/api/admin/audit', requireRole('admin'), async (req, res, next) => { try { res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean()); } catch (err) { next(err); } });
const announcementFields = ['title', 'message', 'category', 'startsAt', 'endsAt', 'officialUrl', 'published'];
const normalizeAnnouncement = body => {
  const value = Object.fromEntries(announcementFields
    .filter(field => body[field] !== undefined)
    .map(field => [field, body[field]]));
  for (const field of ['title', 'message', 'startsAt', 'endsAt', 'officialUrl']) {
    if (value[field] !== undefined) value[field] = String(value[field] || '').trim();
  }
  if (value.category !== undefined && !['scholarship', 'upcoming', 'important', 'news'].includes(value.category)) {
    return { error: 'Choose a valid announcement category.' };
  }
  if (value.published !== undefined && typeof value.published !== 'boolean') {
    return { error: 'Published must be true or false.' };
  }
  for (const field of ['startsAt', 'endsAt']) {
    if (value[field] && !isDateOnly(value[field])) return { error: `${field} must be a valid date in YYYY-MM-DD format.` };
  }
  if (value.startsAt && value.endsAt && value.startsAt > value.endsAt) {
    return { error: 'The end date cannot be before the start date.' };
  }
  if (value.officialUrl && !/^https?:\/\/\S+$/i.test(value.officialUrl)) {
    return { error: 'Official link must be a valid HTTP or HTTPS URL.' };
  }
  return { value };
};
app.get('/api/admin/announcements', async (_req, res, next) => {
  try { res.json(await Announcement.find().sort({ createdAt: -1 }).lean()); } catch (err) { next(err); }
});
app.post('/api/admin/announcements', requireCsrfForMutation, async (req, res, next) => {
  try {
    const { value, error } = normalizeAnnouncement(req.body);
    if (error) return res.status(400).json({ error });
    if (!value.title || !value.message) return res.status(400).json({ error: 'Title and message are required.' });
    const announcement = await Announcement.create(value);
    await audit(req.user._id, 'create announcement', announcement._id, req);
    res.status(201).json(announcement);
  } catch (err) { next(err); }
});
app.put('/api/admin/announcements/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const { value, error } = normalizeAnnouncement(req.body);
    if (error) return res.status(400).json({ error });
    if (value.title !== undefined && !value.title) return res.status(400).json({ error: 'Title is required.' });
    if (value.message !== undefined && !value.message) return res.status(400).json({ error: 'Message is required.' });
    const current = await Announcement.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ error: 'Announcement not found.' });
    const startsAt = value.startsAt ?? current.startsAt;
    const endsAt = value.endsAt ?? current.endsAt;
    if (startsAt && endsAt && startsAt > endsAt) return res.status(400).json({ error: 'The end date cannot be before the start date.' });
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    await audit(req.user._id, 'update announcement', announcement._id, req);
    res.json(announcement);
  } catch (err) { next(err); }
});
app.delete('/api/admin/announcements/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });
    await audit(req.user._id, 'delete announcement', announcement._id, req);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.get('/api/admin/programs', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.q) {
      const query = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expression = new RegExp(query, 'i');
      filter.$or = [{ course: expression }, { dept: expression }, { university: expression }];
    }
    res.json(await Program.find(filter).sort({ course: 1 }).limit(2000).lean());
  } catch (err) { next(err); }
});
app.post('/api/admin/programs', requireCsrfForMutation, async (req, res, next) => {
  try {
    const fields = ['course', 'dept', 'university', 'link', 'level', 'academicYear', 'language', 'duration', 'tuitionNote', 'lastVerified', 'sourceUrl'];
    const program = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    if (!String(program.course || '').trim() || !String(program.university || '').trim()) return res.status(400).json({ error: 'Course and university are required.' });
    const created = await Program.create(program);
    res.status(201).json(created);
  } catch (err) { next(err); }
});
app.put('/api/admin/programs/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const fields = ['course', 'dept', 'university', 'link', 'level', 'academicYear', 'language', 'duration', 'tuitionNote', 'lastVerified', 'sourceUrl'];
    const update = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    if (update.course !== undefined && !String(update.course).trim()) return res.status(400).json({ error: 'Course is required.' });
    if (update.university !== undefined && !String(update.university).trim()) return res.status(400).json({ error: 'University is required.' });
    const program = await Program.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    res.json(program);
  } catch (err) { next(err); }
});
app.delete('/api/admin/programs/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const program = await Program.findByIdAndDelete(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
app.get('/api/admin/universities', async (_req, res, next) => {
  try { res.json(await University.find().sort({ region: 1, name: 1 }).lean()); } catch (err) { next(err); }
});
app.put('/api/admin/universities/:id', requireCsrfForMutation, async (req, res, next) => {
  try {
    const fields = ['city', 'intake', 'deadline', 'lastCycle', 'source', 'website', 'admissionsUrl', 'dsuApplyUrl', 'accessibilityNote', 'lastVerified'];
    const update = Object.fromEntries(fields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]]));
    const university = await University.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!university) return res.status(404).json({ error: 'University not found.' });
    res.json(university);
  } catch (err) { next(err); }
});
app.get('/api/admin/leads', async (_req, res, next) => {
  try { res.json(await Lead.find().sort({ createdAt: -1 }).limit(500).lean()); } catch (err) { next(err); }
});
app.post('/api/admin/import/preview', requireCsrfForMutation, (req, res) => {
  const entity = String(req.body.entity || 'programs');
  if (typeof req.body.csv !== 'string') return res.status(400).json({ error: 'CSV content is required.' });
  const result = validateImport(entity, parseCsv(req.body.csv));
  res.json({ rows: result.rows || [], errors: result.errors });
});
app.post('/api/admin/import', requireCsrfForMutation, async (req, res, next) => {
  try {
    const entity = String(req.body.entity || 'programs');
    const rows = typeof req.body.csv === 'string' ? parseCsv(req.body.csv) : req.body.rows;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'CSV content or rows are required.' });
    const result = validateImport(entity, rows);
    if (!result.valid) return res.status(400).json({ error: result.errors[0], errors: result.errors });
    const Model = entity === 'programs' ? Program : University;
    if (req.body.replace === true) await Model.deleteMany({});
    if (result.rows.length) await Model.insertMany(result.rows);
    res.json({ imported: result.rows.length });
  } catch (err) { next(err); }
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
const clientBuildPath = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
  app.use(express.static(clientBuildPath, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuildPath, 'index.html')));
}
app.use((err, _req, res, _next) => {
  console.error('API request failed:', process.env.NODE_ENV === 'test' ? err.stack || err.name : err.name || 'Error');
  res.status(500).json({ error: 'A server error occurred. Please try again.' });
});

if (require.main === module) {
  const mongoose = require('mongoose');
  const { config } = require('./config');

  mongoose.connect(config.mongoUri)
    .then(() => {
      app.listen(config.port, () => console.log(`Secure API on http://localhost:${config.port}`));
    })
    .catch(error => {
      console.error('MongoDB connection failed:', error.message);
      process.exit(1);
    });
}

module.exports = app;
