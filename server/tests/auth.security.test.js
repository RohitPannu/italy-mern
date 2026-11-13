const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
jest.mock('../services/email', () => ({ sendEmail: jest.fn() }));
const { sendEmail } = require('../services/email');
const { User, AuthToken, Session } = require('../models/auth');
const { Announcement } = require('../models');
const { hashToken } = require('../services/security');
const { hashPassword } = require('../services/password');
const app = require('../app');
let mongo;

beforeAll(async () => {
  if (process.env.MONGO_TEST_URI) await mongoose.connect(process.env.MONGO_TEST_URI);
  else { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); }
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  app.locals.authLimiters.login.resetKey('::ffff:127.0.0.1');
  app.locals.authLimiters.login.resetKey('127.0.0.1');
  app.locals.authLimiters.recovery.resetKey('::ffff:127.0.0.1');
  app.locals.authLimiters.recovery.resetKey('127.0.0.1');
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ sent: true });
});

const register = async email => request(app).post('/api/auth/register').send({ name: 'Verification Student', email, password: 'StrongPassword12', confirmPassword: 'StrongPassword12' });
const login = async email => request(app).post('/api/auth/login').send({ email, password: 'StrongPassword12' });
const loginAsAdmin = async (role = 'admin') => {
  await User.create({
    name: 'Admin User',
    email: `admin-${role}@example.com`,
    passwordHash: await hashPassword('StrongPassword12'),
    role,
    mfaEnabled: false
  });
  return request(app).post('/api/auth/login').send({ email: `admin-${role}@example.com`, password: 'StrongPassword12' });
};
const cookieHeader = response => response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
const csrfToken = response => response.headers['set-cookie'].find(cookie => cookie.startsWith('csrfToken=')).split(';')[0].slice('csrfToken='.length);
const resetTokenFromEmail = () => {
  const message = sendEmail.mock.calls.find(([mail]) => mail.subject === 'Reset your password')?.[0];
  return message?.html.match(/token=([a-f0-9]{64})/)?.[1];
};
const verificationTokenFromEmail = () => {
  const message = sendEmail.mock.calls.find(([mail]) => mail.subject === 'Verify your Study in Italy account')?.[0];
  return message?.html.match(/token=([a-f0-9]{64})/)?.[1];
};

test('public registration is student-only and rejects role injection', async () => {
  const response = await request(app).post('/api/auth/register').send({ name: 'Student', email: 'student@test.com', password: 'StrongPassword12', confirmPassword: 'StrongPassword12', role: 'admin' });
  expect(response.status).toBe(201); expect(response.body.user.role).toBe('student');
});

test('registration normalizes email and duplicate accounts return a safe conflict', async () => {
  expect((await register('  Student@Example.com  ')).status).toBe(201);
  const duplicate = await register('student@example.com');
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error).toBe('An account with this email already exists.');
});

test('registration, login, and recovery reject malformed email addresses', async () => {
  const registration = await request(app).post('/api/auth/register').send({ name: 'Student', email: 'not-an-email', password: 'StrongPassword12', confirmPassword: 'StrongPassword12' });
  const loginResponse = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'StrongPassword12' });
  const recovery = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });
  expect(registration.status).toBe(400);
  expect(loginResponse.status).toBe(400);
  expect(recovery.status).toBe(400);
});

test('login normalizes email and uses a generic invalid-credential response', async () => {
  await register('student@example.com');
  const valid = await request(app).post('/api/auth/login').send({ email: ' Student@Example.com ', password: 'StrongPassword12' });
  expect(valid.status).toBe(200);
  const invalid = await request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'WrongPassword12' });
  expect(invalid.status).toBe(401);
  expect(invalid.body.error).toBe('Email or password is incorrect.');
});

test('admin and editor login requires only email and password', async () => {
  const admin = await loginAsAdmin();
  expect(admin.status).toBe(200);
  expect(admin.body.user.role).toBe('admin');
  expect(admin.headers['set-cookie']).toBeDefined();
  expect((await loginAsAdmin('editor')).status).toBe(200);
});

test('forgot password gives the same response for known and unknown addresses', async () => {
  await register('student@example.com');
  const known = await request(app).post('/api/auth/forgot-password').send({ email: ' Student@Example.com ' });
  const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' });
  expect(known.status).toBe(200);
  expect(known.body).toEqual(unknown.body);
  expect(sendEmail.mock.calls.filter(([mail]) => mail.subject === 'Reset your password')).toHaveLength(1);
  const rawToken = resetTokenFromEmail();
  expect(rawToken).toHaveLength(64);
  const savedToken = await AuthToken.findOne({ type: 'resetPassword' });
  expect(savedToken.tokenHash).toBe(hashToken(rawToken));
  expect(savedToken.tokenHash).not.toBe(rawToken);
});

test('admin password recovery emails use the admin reset page', async () => {
  await User.create({
    name: 'Admin User',
    email: 'admin-recovery@example.com',
    passwordHash: await hashPassword('StrongPassword12'),
    role: 'admin',
    mfaEnabled: true
  });
  const response = await request(app).post('/api/auth/forgot-password').send({ email: 'admin-recovery@example.com' });
  expect(response.status).toBe(200);
  const email = sendEmail.mock.calls.find(([mail]) => mail.subject === 'Reset your password')?.[0];
  expect(email.html).toContain('/admin/reset-password?token=');
});

test('login rate limiting rejects attempts beyond the configured limit', async () => {
  const attempts = await Promise.all(Array.from({ length: 11 }, () => request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'WrongPassword12' })));
  expect(attempts.filter(response => response.status === 429)).toHaveLength(1);
  expect(attempts.filter(response => response.status === 401)).toHaveLength(10);
});

test('email verification consumes its token exactly once', async () => {
  await register('student@example.com');
  const token = verificationTokenFromEmail();
  expect(token).toHaveLength(64);
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200);
  expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400);
  expect((await mongoose.model('User').findOne({ email: 'student@example.com' })).emailVerified).toBe(true);
});

test('reset tokens are single-use and a successful reset revokes sessions', async () => {
  await register('student@example.com');
  const signedIn = await login('student@example.com');
  const cookies = cookieHeader(signedIn);
  expect((await request(app).get('/api/auth/me').set('Cookie', cookies)).status).toBe(200);
  await request(app).post('/api/auth/forgot-password').send({ email: 'student@example.com' });
  const token = resetTokenFromEmail();
  const payload = { token, password: 'NewPassword34', confirmPassword: 'NewPassword34' };
  const reset = await request(app).post('/api/auth/reset-password').send(payload);
  expect(reset.status).toBe(200);
  expect((await request(app).post('/api/auth/reset-password').send(payload)).status).toBe(400);
  expect((await request(app).get('/api/auth/me').set('Cookie', cookies)).status).toBe(401);
  expect((await login('student@example.com')).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({ email: 'student@example.com', password: 'NewPassword34' })).status).toBe(200);
  const userId = (await mongoose.model('User').findOne({ email: 'student@example.com' }))._id;
  expect(await Session.countDocuments({ userId, revokedAt: null })).toBe(1);
  expect(await Session.countDocuments({ userId, revokedAt: { $ne: null } })).toBe(1);
});

test('expired reset tokens are rejected', async () => {
  await register('student@example.com');
  await request(app).post('/api/auth/forgot-password').send({ email: 'student@example.com' });
  const token = resetTokenFromEmail();
  await AuthToken.updateOne({ type: 'resetPassword' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const response = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword34', confirmPassword: 'NewPassword34' });
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Reset link is invalid or expired.');
});

test('admin routes require an authenticated cookie and role', async () => {
  const response = await request(app).get('/api/admin/users');
  expect(response.status).toBe(401);
});

test('admin data routes use authenticated role-based access and CSRF protection', async () => {
  const student = await register('student@example.com');
  const studentSession = await login('student@example.com');
  expect(student.status).toBe(201);
  expect((await request(app).get('/api/admin/programs').set('Cookie', cookieHeader(studentSession))).status).toBe(403);

  const adminSession = await loginAsAdmin();
  const cookies = cookieHeader(adminSession);
  const csrf = csrfToken(adminSession);
  const payload = { course: 'Computer Science', university: 'University of Example', level: 'master' };
  expect((await request(app).post('/api/admin/programs').set('Cookie', cookies).send(payload)).status).toBe(403);

  const created = await request(app).post('/api/admin/programs').set('Cookie', cookies).set('x-csrf-token', csrf).send(payload);
  expect(created.status).toBe(201);
  const programId = created.body._id;
  expect((await request(app).get('/api/admin/programs?q=Computer%20Science').set('Cookie', cookies)).body).toHaveLength(1);
  expect((await request(app).put(`/api/admin/programs/${programId}`).set('Cookie', cookies).set('x-csrf-token', csrf).send({ course: 'Data Science' })).body.course).toBe('Data Science');
  expect((await request(app).delete(`/api/admin/programs/${programId}`).set('Cookie', cookies).set('x-csrf-token', csrf)).status).toBe(200);
});

test('admin CSV import preview and commit validate rows', async () => {
  const adminSession = await loginAsAdmin();
  const cookies = cookieHeader(adminSession);
  const csrf = csrfToken(adminSession);
  const csv = 'course,dept,university,level,academicYear,language,duration,tuitionNote,lastVerified,sourceUrl,link\nComputer Science,Computing,University of Example,master,2026/27,English,2,Fee details,2026-10-25,https://example.edu,https://example.edu/course';
  const preview = await request(app).post('/api/admin/import/preview').set('Cookie', cookies).set('x-csrf-token', csrf).send({ entity: 'programs', csv });
  expect(preview.status).toBe(200);
  expect(preview.body.errors).toEqual([]);
  expect(preview.body.rows).toHaveLength(1);

  const invalid = await request(app).post('/api/admin/import').set('Cookie', cookies).set('x-csrf-token', csrf).send({ entity: 'programs', csv: 'course,university\n,University of Example' });
  expect(invalid.status).toBe(400);
  expect(await mongoose.model('Program').countDocuments()).toBe(0);

  const imported = await request(app).post('/api/admin/import').set('Cookie', cookies).set('x-csrf-token', csrf).send({ entity: 'programs', csv });
  expect(imported.status).toBe(200);
  expect(imported.body.imported).toBe(1);
});

test('admin university and lead routes support the admin page', async () => {
  const adminSession = await loginAsAdmin();
  const cookies = cookieHeader(adminSession);
  const csrf = csrfToken(adminSession);
  const university = await mongoose.model('University').create({ name: 'University of Example', region: 'Lazio' });
  await mongoose.model('Lead').create({ name: 'Student', email: 'student@example.com', message: 'Interested' });

  expect((await request(app).get('/api/admin/universities').set('Cookie', cookies)).body).toHaveLength(1);
  const updated = await request(app).put(`/api/admin/universities/${university._id}`).set('Cookie', cookies).set('x-csrf-token', csrf).send({ deadline: '2026-12-01' });
  expect(updated.status).toBe(200);
  expect(updated.body.deadline).toBe('2026-12-01');
  const leads = await request(app).get('/api/admin/leads').set('Cookie', cookies);
  expect(leads.status).toBe(200);
  expect(leads.body[0].email).toBe('student@example.com');
});

test('admin can create, update, list, and delete scholarships while students see only current calls', async () => {
  const adminSession = await loginAsAdmin();
  const cookies = cookieHeader(adminSession);
  const csrf = csrfToken(adminSession);
  await mongoose.model('University').create({ name: 'University of Example', region: 'Lazio' });
  const payload = {
    title: 'Regional Study Grant',
    provider: 'Lazio DSU',
    region: 'Lazio',
    universities: [{ name: 'University of Example', description: 'Available for eligible enrolled students.' }],
    description: 'Need-based support for eligible students.',
    benefits: 'Tuition support and stipend',
    applicationStart: '2026-07-01',
    deadline: '2026-12-01',
    intake: '2026/27',
    eligibility: 'Based on academic and family-income criteria.',
    requirements: ['Passport', 'Income records'],
    procedure: ['Apply through the regional portal'],
    officialUrl: 'https://example.edu/scholarships',
    lastVerified: '2026-10-25',
    status: 'active'
  };
  expect((await request(app).post('/api/admin/scholarships').set('Cookie', cookies).send(payload)).status).toBe(403);
  const created = await request(app).post('/api/admin/scholarships')
    .set('Cookie', cookies).set('x-csrf-token', csrf).send(payload);
  expect(created.status).toBe(201);
  expect(created.body.universities[0].description).toBe(payload.universities[0].description);

  await mongoose.model('Scholarship').create({ ...payload, title: 'Closed Grant', status: 'closed' });
  await mongoose.model('Scholarship').create({ ...payload, title: 'Expired Grant', deadline: '2020-01-01' });
  const currentCalls = await request(app).get('/api/scholarships');
  expect(currentCalls.status).toBe(200);
  expect(currentCalls.body.map(scholarship => scholarship.title)).toEqual(['Regional Study Grant']);

  const updated = await request(app).put(`/api/admin/scholarships/${created.body._id}`)
    .set('Cookie', cookies).set('x-csrf-token', csrf).send({ status: 'upcoming', procedure: ['Apply online', 'Submit documents'] });
  expect(updated.status).toBe(200);
  expect(updated.body.status).toBe('upcoming');
  expect(updated.body.procedure).toEqual(['Apply online', 'Submit documents']);
  expect((await request(app).get('/api/scholarships')).body.map(scholarship => scholarship.title)).toContain('Regional Study Grant');

  const invalid = await request(app).post('/api/admin/scholarships')
    .set('Cookie', cookies).set('x-csrf-token', csrf).send({ ...payload, deadline: '2026-02-30' });
  expect(invalid.status).toBe(400);
  expect((await request(app).delete(`/api/admin/scholarships/${created.body._id}`)
    .set('Cookie', cookies).set('x-csrf-token', csrf)).status).toBe(200);
});

test('admin announcement management and student feed enforce role, publication, and date bounds', async () => {
  expect((await request(app).get('/api/me/announcements')).status).toBe(401);
  const adminSession = await loginAsAdmin();
  const adminCookies = cookieHeader(adminSession);
  const csrf = csrfToken(adminSession);
  const payload = {
    title: 'Scholarship call opens soon',
    message: 'Prepare your documents now.',
    category: 'upcoming',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    officialUrl: 'https://example.edu/scholarships',
    published: true
  };
  expect((await request(app).get('/api/me/announcements').set('Cookie', adminCookies)).status).toBe(403);
  const created = await request(app).post('/api/admin/announcements')
    .set('Cookie', adminCookies).set('x-csrf-token', csrf).send(payload);
  expect(created.status).toBe(201);

  await Announcement.create({ ...payload, title: 'Future notice', startsAt: '2099-01-01' });
  await Announcement.create({ ...payload, title: 'Expired notice', endsAt: '2020-01-01' });
  await Announcement.create({ ...payload, title: 'Draft notice', published: false });

  const studentRegistration = await register('announcement-student@example.com');
  expect(studentRegistration.status).toBe(201);
  const studentSession = await login('announcement-student@example.com');
  const studentCookies = cookieHeader(studentSession);
  const visible = await request(app).get('/api/me/announcements').set('Cookie', studentCookies);
  expect(visible.status).toBe(200);
  expect(visible.body.map(announcement => announcement.title)).toEqual(['Scholarship call opens soon']);

  const updated = await request(app).put(`/api/admin/announcements/${created.body._id}`)
    .set('Cookie', adminCookies).set('x-csrf-token', csrf).send({ category: 'important', published: false });
  expect(updated.status).toBe(200);
  expect(updated.body.published).toBe(false);
  const invalidDates = await request(app).put(`/api/admin/announcements/${created.body._id}`)
    .set('Cookie', adminCookies).set('x-csrf-token', csrf).send({ startsAt: '2027-01-01' });
  expect(invalidDates.status).toBe(400);
  expect((await request(app).get('/api/me/announcements').set('Cookie', studentCookies)).body).toHaveLength(0);
  expect((await request(app).delete(`/api/admin/announcements/${created.body._id}`)
    .set('Cookie', adminCookies).set('x-csrf-token', csrf)).status).toBe(200);
});

test('server serves the built app routes and returns JSON for unknown API routes', async () => {
  expect((await request(app).get('/')).status).toBe(200);
  expect((await request(app).get('/student/dashboard')).status).toBe(200);
  const missing = await request(app).get('/api/not-a-route');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ error: 'API route not found.' });
});

test('logout revokes only the current session and protected routes reject it', async () => {
  await register('student@example.com');
  const signedIn = await login('student@example.com');
  const otherSession = await login('student@example.com');
  const cookies = cookieHeader(signedIn);
  const response = await request(app).post('/api/auth/logout').set('Cookie', cookies).set('x-csrf-token', csrfToken(signedIn));
  expect(response.status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Cookie', cookies)).status).toBe(401);
  expect((await request(app).get('/api/auth/me').set('Cookie', cookieHeader(otherSession))).status).toBe(200);
});

test('logout can revoke a refresh session after its access cookie is gone', async () => {
  await register('student@example.com');
  const signedIn = await login('student@example.com');
  const refresh = signedIn.headers['set-cookie'].find(cookie => cookie.startsWith('refreshToken=')).split(';')[0];
  const csrf = csrfToken(signedIn);
  const response = await request(app).post('/api/auth/logout').set('Cookie', `${refresh}; csrfToken=${csrf}`).set('x-csrf-token', csrf);
  expect(response.status).toBe(200);
  expect(await Session.countDocuments({ tokenHash: hashToken(refresh.slice('refreshToken='.length)), revokedAt: null })).toBe(0);
});

test('expired database sessions cannot use protected routes', async () => {
  await register('student@example.com');
  const signedIn = await login('student@example.com');
  const refresh = signedIn.headers['set-cookie'].find(cookie => cookie.startsWith('refreshToken=')).split(';')[0].slice('refreshToken='.length);
  await Session.updateOne({ tokenHash: hashToken(refresh) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const response = await request(app).get('/api/auth/me').set('Cookie', cookieHeader(signedIn));
  expect(response.status).toBe(401);
});

test('shortlist data is scoped to the authenticated student', async () => {
  await register('first@example.com');
  const first = await login('first@example.com');
  const firstCookies = cookieHeader(first);
  const write = await request(app).put('/api/me/shortlist').set('Cookie', firstCookies).set('x-csrf-token', csrfToken(first)).send({ programIds: ['507f1f77bcf86cd799439011'] });
  expect(write.status).toBe(200);
  await register('second@example.com');
  const second = await login('second@example.com');
  const response = await request(app).get('/api/me/shortlist').set('Cookie', cookieHeader(second));
  expect(response.status).toBe(200);
  expect(response.body.programIds).toEqual([]);
});

test('state-changing requests require CSRF', async () => {
  await register('student@test.com');
  const loginResponse = await login('student@test.com');
  const cookie = loginResponse.headers['set-cookie'];
  const response = await request(app).post('/api/auth/change-password').set('Cookie', cookie).send({ currentPassword: 'StrongPassword12', newPassword: 'AnotherStrong12!' });
  expect(response.status).toBe(403);
});

test('refresh rotation detects reuse', async () => {
  await register('refresh@test.com');
  const loginResponse = await login('refresh@test.com');
  const refresh = loginResponse.headers['set-cookie'].find(c => c.includes('refreshToken='));
  const cookies = cookieHeader(loginResponse);
  const csrf = csrfToken(loginResponse);
  const rotated = await request(app).post('/api/auth/refresh').set('Cookie', cookies).set('x-csrf-token', csrf);
  expect(rotated.status).toBe(200);
  const reused = await request(app).post('/api/auth/refresh').set('Cookie', `${refresh.split(';')[0]}; csrfToken=${csrf}`).set('x-csrf-token', csrf);
  expect(reused.status).toBe(401);
});
