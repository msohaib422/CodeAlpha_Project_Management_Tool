const nodemailer = require('nodemailer');
const {
  normalizeEmail,
  suppressEmail,
  filterSuppressed,
} = require('./emailSuppression');

const APP_NAME = 'CollabPM';
const APP_URL = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();

class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email service is not configured (SMTP_HOST missing).');
    this.name = 'EmailNotConfiguredError';
    this.code = 'EMAIL_NOT_CONFIGURED';
  }
}

class EmailDeliveryError extends Error {
  constructor(message) {
    super(message || 'Email provider rejected the message.');
    this.name = 'EmailDeliveryError';
    this.code = 'EMAIL_DELIVERY_FAILED';
  }
}

class EmailSuppressedError extends Error {
  constructor(message) {
    super(message || 'Recipient is permanently suppressed.');
    this.name = 'EmailSuppressedError';
    this.code = 'EMAIL_SUPPRESSED';
  }
}

class EmailInfrastructureError extends Error {
  constructor(message) {
    super(message || 'Email infrastructure failure.');
    this.name = 'EmailInfrastructureError';
    this.code = 'EMAIL_INFRASTRUCTURE_FAILED';
  }
}

let cachedTransporter = null;
const getTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return cachedTransporter;
};

const button = (text, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td align="center" style="border-radius:8px;background:#6366f1;">
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${text}</a>
      </td>
    </tr>
  </table>`;

const baseTemplate = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:22px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.2);text-align:center;vertical-align:middle;font-size:20px;font-weight:700;color:#ffffff;">C</td>
                  <td style="padding-left:12px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${APP_NAME}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h1>
              <div style="font-size:15px;line-height:1.6;color:#334155;">${bodyHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;line-height:1.6;border-top:1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br />
              This is an automated message. Please do not reply directly to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const parseRecipients = (to) => {
  if (Array.isArray(to)) return to.map((item) => String(item).trim()).filter(Boolean);
  return String(to || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const isInfrastructureFailure = (err) => {
  if (err instanceof EmailNotConfiguredError) return true;
  const code = String((err && err.code) || '').toUpperCase();
  const infraCodes = new Set([
    'ECONNECTION',
    'ETIMEDOUT',
    'ESOCKET',
    'EDNS',
    'EAUTH',
    'EAI_AGAIN',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ECONNREFUSED',
  ]);
  if (infraCodes.has(code)) return true;
  const message = String((err && err.message) || '').toLowerCase();
  if (!err || !err.responseCode) {
    return true;
  }
  return false;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const recipients = parseRecipients(to);
  if (!recipients.length) {
    throw new EmailDeliveryError('No recipients provided.');
  }

  const pairs = recipients
    .map((original) => ({ original, normalized: normalizeEmail(original) }))
    .filter((pair) => pair.normalized);

  // Centralized suppression check before any provider interaction.
  const { allowed, suppressed } = await filterSuppressed(pairs.map((pair) => pair.normalized));
  const allowedSet = new Set(allowed);
  const toSendPairs = pairs.filter((pair) => allowedSet.has(pair.normalized));
  const suppressedRecipients = pairs
    .filter((pair) => !allowedSet.has(pair.normalized))
    .map((pair) => pair.normalized);

  if (suppressedRecipients.length) {
    console.warn(`[email] suppressed recipients skipped: ${suppressedRecipients.join(', ')}`);
  }

  if (!toSendPairs.length) {
    console.warn(`[email] all recipients suppressed; skipping delivery: ${suppressedRecipients.join(', ')}`);
    throw new EmailSuppressedError(`All recipients suppressed: ${suppressedRecipients.join(', ')}`);
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.error('[email] skipped — SMTP not configured (SMTP_HOST missing).');
    throw new EmailNotConfiguredError();
  }

  const from = process.env.SMTP_FROM || `"${APP_NAME}" <no-reply@collabpm.com>`;
  const sendTo = toSendPairs.map((pair) => pair.original);

  try {
    const info = await transporter.sendMail({
      from,
      to: sendTo.length === 1 ? sendTo[0] : sendTo,
      subject,
      html,
      text: text || subject,
    });
    console.log(`[email] accepted by provider -> to=${sendTo.join(', ')} subject="${subject}" messageId=${info.messageId}`);
    return info;
  } catch (err) {
    const providerDetail = `${err && err.code ? err.code : ''} ${err && err.responseCode ? err.responseCode : ''} ${err && err.message ? err.message : ''}`.trim();
    console.error(`[email] delivery failed -> to=${sendTo.join(', ')} subject="${subject}" code=${err && err.responseCode ? err.responseCode : ''} message=${err && err.message ? err.message : ''}`);

    if (isInfrastructureFailure(err)) {
      console.error(`[email] infrastructure failure (recipients NOT suppressed): ${providerDetail}`);
      throw new EmailInfrastructureError(err && err.message ? err.message : 'Email infrastructure failure.');
    }

    // Permanent suppression for recipient-specific failures (including transient recipient failures).
    for (const pair of toSendPairs) {
      try {
        await suppressEmail({
          email: pair.normalized,
          reason: err && err.message ? err.message : 'Email delivery failed',
          category: 'recipient',
          providerError: providerDetail,
        });
      } catch (suppressErr) {
        console.error(`[email] failed to record suppression for ${pair.normalized}: ${suppressErr.message}`);
      }
    }

    throw new EmailDeliveryError(err && err.message ? err.message : 'Email provider rejected the message.');
  }
};

const sendOTP = (to, otp, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Your verification code`,
    html: baseTemplate('Verify your email address', `
      <p style="margin:0 0 12px;">Hi ${name || 'there'},</p>
      <p style="margin:0 0 16px;">Thanks for signing up for ${APP_NAME}. Use the verification code below to confirm your email address.</p>
      <div style="margin:18px 0;padding:18px;background:#eef2ff;border-radius:10px;text-align:center;">
        <span style="font-size:34px;font-weight:700;letter-spacing:8px;color:#6366f1;">${otp}</span>
      </div>
      <p style="margin:0 0 8px;"><strong>This code expires in 5 minutes.</strong></p>
      <p style="margin:0 0 8px;">For your security, never share this code with anyone. ${APP_NAME} staff will never ask you for it.</p>
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;">If you did not create an account, you can safely ignore this email.</p>
    `),
    text: `Hi ${name || 'there'},\n\nYour ${APP_NAME} verification code is: ${otp}\n\nThis code expires in 5 minutes.\nFor your security, never share this code with anyone.\n\nIf you did not create an account, you can safely ignore this email.`,
  });

const sendRegistrationConfirmation = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration received`,
    html: baseTemplate('Registration received', `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 8px;">Your email address has been verified successfully.</p>
      <p style="margin:0 0 8px;">Your registration is now pending administrator approval. We will notify you as soon as your account is approved.</p>
    `),
    text: `Hi ${name},\n\nYour email address has been verified. Your registration is now pending administrator approval. We will notify you once it is approved.`,
  });

const sendAdminNewRegistration = (to, name, email, registeredAt, userId) => {
  const dateStr = registeredAt ? new Date(registeredAt).toLocaleString() : new Date().toLocaleString();
  const reviewUrl = userId ? `${APP_URL}/users?highlight=${userId}` : `${APP_URL}/users`;
  return sendEmail({
    to,
    subject: `${APP_NAME} - New registration pending approval`,
    html: baseTemplate('New registration pending approval', `
      <p style="margin:0 0 12px;">A new user has verified their email and is waiting for approval.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0;width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-weight:600;width:150px;">Name</td><td style="padding:6px 0;">${name}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Email</td><td style="padding:6px 0;">${email}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Registration date</td><td style="padding:6px 0;">${dateStr}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Status</td><td style="padding:6px 0;">Pending Approval</td></tr>
      </table>
      ${button('Open User Management', reviewUrl)}
    `),
    text: `A new user has verified their email and is waiting for approval.\n\nName: ${name}\nEmail: ${email}\nRegistration date: ${dateStr}\nStatus: Pending Approval\n\nReview: ${reviewUrl}`,
  });
};

const sendApproval = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Your registration has been approved`,
    html: baseTemplate('Registration approved', `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 12px;">Great news! Your registration has been approved. You can now log in and start collaborating.</p>
      ${button('Log In', `${APP_URL}/login`)}
    `),
    text: `Hi ${name},\n\nYour registration has been approved. You can now log in: ${APP_URL}/login`,
  });

const sendRejection = (to, name, reason) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration update`,
    html: baseTemplate('Registration update', `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 12px;">We are writing to let you know that your registration request was not approved at this time.</p>
      ${reason ? `<p style="margin:0 0 12px;"><strong>Reason:</strong> ${reason}</p>` : ''}
      <p style="margin:0 0 12px;">If you believe this is an error, please contact your administrator.</p>
    `),
    text: `Hi ${name},\n\nYour registration request was not approved.${reason ? '\nReason: ' + reason : ''}\n\nIf you believe this is an error, please contact your administrator.`,
  });

const sendAdminCreatedUser = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Your account has been created`,
    html: baseTemplate('Account created', `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 12px;">An administrator has created an account for you. You can now log in to get started.</p>
      ${button('Log In', `${APP_URL}/login`)}
    `),
    text: `Hi ${name},\n\nAn administrator has created an account for you. Please log in: ${APP_URL}/login`,
  });

const sendInvitationEmail = (to, inviterName, projectName, link) =>
  sendEmail({
    to,
    subject: `You're invited to join ${projectName} on ${APP_NAME}`,
    html: baseTemplate('Project invitation', `
      <p style="margin:0 0 12px;">Hi,</p>
      <p style="margin:0 0 12px;"><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> on ${APP_NAME}.</p>
      <p style="margin:0 0 16px;">Click the button below to accept the invitation and start collaborating.</p>
      ${button('Accept Invitation', link)}
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;">If you were not expecting this invitation, you can safely ignore this email.</p>
    `),
    text: `Hi,\n\n${inviterName} invited you to join project "${projectName}" on ${APP_NAME}.\n\nAccept: ${link}\n\nIf you were not expecting this invitation, you can safely ignore this email.`,
  });

const sendProjectActivity = (to, projectName, action, taskTitle, actorName, details, link) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - ${projectName}: ${action}`,
    html: baseTemplate(`${projectName} update`, `
      <p style="margin:0 0 12px;"><strong>${actorName}</strong> ${action}${taskTitle ? ` on task "<strong>${taskTitle}</strong>"` : ''}.</p>
      ${details ? `<p style="margin:0 0 12px;">${details}</p>` : ''}
      ${button('Open Project', link || APP_URL)}
    `),
    text: `${actorName} ${action}${taskTitle ? ' on task "' + taskTitle + '"' : ''}.${details ? '\n' + details : ''}\nOpen: ${link || APP_URL}`,
  });

const verifyEmailConfig = () => {
  const present = {
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_PORT: !!process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE || 'false',
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASS: !!process.env.SMTP_PASS,
    SMTP_FROM: !!process.env.SMTP_FROM,
  };
  console.log('[email] config presence:', JSON.stringify(present));
  if (!present.SMTP_HOST) {
    console.warn('[email] WARNING: SMTP_HOST is not set — emails will FAIL.');
  }
};

module.exports = {
  sendEmail,
  sendOTP,
  sendRegistrationConfirmation,
  sendAdminNewRegistration,
  sendApproval,
  sendRejection,
  sendAdminCreatedUser,
  sendProjectActivity,
  sendInvitationEmail,
  EmailNotConfiguredError,
  EmailDeliveryError,
  EmailSuppressedError,
  EmailInfrastructureError,
  verifyEmailConfig,
};