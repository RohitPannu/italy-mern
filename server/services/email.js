const nodemailer = require('nodemailer');
const { config } = require('../config');
const transporter = config.smtp.host && config.smtp.user ? nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465, auth: { user: config.smtp.user, pass: config.smtp.pass } }) : null;
async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    if (config.nodeEnv !== 'production') console.info(`[email disabled] ${subject} -> ${to}`);
    return { sent: false, reason: 'SMTP not configured' };
  }
  return transporter.sendMail({ from: config.smtp.from, to, subject, html });
}
module.exports = { sendEmail };
