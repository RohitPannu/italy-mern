const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, validateRegistration, createTokenPayload } = require('./auth-utils');

test('registration validation enforces strong passwords and matching confirmation', () => {
  assert.deepEqual(validateRegistration({ name: '', email: 'bad', password: 'weak', confirmPassword: 'weak' }), {
    valid: false,
    errors: ['Enter your full name.', 'Enter a valid email address.', 'Use at least 8 characters with a number and uppercase letter.']
  });
  assert.equal(validateRegistration({ name: 'Ali Khan', email: 'ali@example.com', password: 'Strong12', confirmPassword: 'Strong12' }).valid, true);
});

test('token payloads keep student and admin roles separate', () => {
  assert.deepEqual(createTokenPayload('student-1', 'student'), { sub: 'student-1', role: 'student' });
  assert.deepEqual(createTokenPayload('admin-1', 'admin'), { sub: 'admin-1', role: 'admin' });
});

test('email normalization is case-insensitive', () => {
  assert.equal(normalizeEmail(' ALI@Example.COM '), 'ali@example.com');
});
