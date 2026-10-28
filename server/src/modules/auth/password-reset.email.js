const nodemailer = require('nodemailer');
const { readEnv } = require('../../config/env');

async function sendPasswordResetEmail(email, resetUrl) {
  const config = readEnv();

  if (
    !config.SMTP_HOST ||
    !config.SMTP_USER ||
    !config.SMTP_PASS ||
    !config.EMAIL_FROM
  ) {
    throw new Error('Password reset email service is not configured');
  }

  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE === 'true',
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    subject: 'Reset your Study Platform password',
    text: [
      'We received a request to reset your password.',
      '',
      'Use the link below to choose a new password. It expires in 30 minutes and can only be used once.',
      '',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  });
}

module.exports = { sendPasswordResetEmail };