const { config } = require('../config');
const readline = require('readline');
const mongoose = require('mongoose');
const { User, AuthToken } = require('../models/auth');
const { hashPassword, validatePassword } = require('../services/password');
const { hashToken, randomToken } = require('../services/security');
const { sendEmail } = require('../services/email');

class SafeSetupError extends Error {}

const prompt = question => new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, answer => {
    rl.close();
    resolve(answer.trim());
  });
});

const promptHidden = label => new Promise((resolve, reject) => {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    reject(new SafeSetupError('Run this command in an interactive terminal.'));
    return;
  }

  let value = '';
  const cleanup = () => {
    input.removeListener('keypress', onKeypress);
    input.setRawMode(false);
    input.pause();
    process.stdout.write('\n');
  };
  const onKeypress = (character, key = {}) => {
    if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
      cleanup();
      reject(new SafeSetupError('Admin setup cancelled.'));
    } else if (key.name === 'return' || key.name === 'enter') {
      cleanup();
      resolve(value);
    } else if (key.name === 'backspace') {
      value = value.slice(0, -1);
      process.stdout.write('\b \b');
    } else if (character && !key.ctrl && !key.meta) {
      value += character;
      process.stdout.write('*');
    }
  };

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  input.on('keypress', onKeypress);
  process.stdout.write(label);
});

async function createInitialAdmin() {
  if (config.nodeEnv !== 'production') {
    throw new SafeSetupError('Set NODE_ENV=production and use the client-approved production environment.');
  }

  const existingAdmin = await User.exists({ role: 'admin' });
  if (existingAdmin) throw new SafeSetupError('An admin already exists; no account was changed.');

  const name = await prompt('Admin name: ');
  const email = (await prompt('Admin email: ')).toLowerCase();
  if (name.length < 2 || name.length > 100) throw new SafeSetupError('Name must be between 2 and 100 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SafeSetupError('Enter a valid email address.');
  if (await User.exists({ email })) throw new SafeSetupError('An account already uses that email; no account was changed.');

  const password = await promptHidden('New admin password (input hidden): ');
  const confirmation = await promptHidden('Confirm admin password (input hidden): ');
  if (password !== confirmation) throw new SafeSetupError('Passwords do not match.');
  if (password.length > 128) throw new SafeSetupError('Password must be no more than 128 characters.');
  const passwordError = validatePassword(password, email);
  if (passwordError) throw new SafeSetupError(passwordError);

  const token = randomToken();
  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    emailVerified: false
  });
  await AuthToken.create({
    userId: user._id,
    type: 'verifyEmail',
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  const verificationUrl = new URL('/verify-email', config.clientUrl);
  verificationUrl.searchParams.set('token', token);
  const delivery = await sendEmail({
    to: email,
    subject: 'Verify your Study in Italy admin account',
    html: `<p>Verify your admin account with <a href="${verificationUrl.toString()}">this secure link</a>.</p>`
  });
  if (delivery?.sent === false || !delivery?.messageId) {
    throw new SafeSetupError('The admin record was created, but email delivery was not confirmed. Fix SMTP and use the account verification flow; do not rerun this command.');
  }

  console.log('Initial admin created. A verification email was sent.');
}

async function main() {
  try {
    if (config.nodeEnv !== 'production') {
      throw new SafeSetupError('Set NODE_ENV=production and use the client-approved production environment.');
    }
    await mongoose.connect(config.mongoUri);
    await createInitialAdmin();
  } catch (error) {
    if (error instanceof SafeSetupError) console.error(error.message);
    else console.error('Admin provisioning failed due to a database or email service error. No existing records were deleted or overwritten. Check privately before retrying.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main();

module.exports = { createInitialAdmin, promptHidden };
