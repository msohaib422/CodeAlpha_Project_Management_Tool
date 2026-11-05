const nodemailer = require('nodemailer');

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

const baseTemplate = (title, bodyHtml) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#6366f1;padding:20px 24px;color:#fff;font-size:20px;font-weight:700;">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.18);text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#fff;">
                C
              </td>
              <td style="padding-left:10px;font-size:20px;font-weight:700;color:#fff;">
                ${APP_NAME}
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px;">
          <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${title}</h2>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
          © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br/>
          This is an automated message from ${APP_NAME}. Please do not reply directly to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.error('[email] skipped — SMTP not configured (SMTP_HOST missing).');
    throw new EmailNotConfiguredError();
  }

  const from = process.env.SMTP_FROM || `"${APP_NAME}" <no-reply@collabpm.com>`;
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`[email] accepted by provider -> to=${to} subject="${subject}" messageId=${info.messageId} response="${info.response}"`);
    return info;
  } catch (err) {
    // Log the provider response server-side for diagnostics (never expose to frontend).
    console.error(`[email] delivery failed -> to=${to} subject="${subject}" code=${err.responseCode || ''} message=${err.message}`);
    throw new EmailDeliveryError();
  }
};

const sendOTP = (to, otp, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Email Verification Code`,
    html: baseTemplate('Verify your email', `
      <p style="margin:0 0 12px;color:#0f172a;">Hi ${name ? name : ''},</p>
      <p style="margin:0 0 16px;color:#475569;">Thanks for signing up for ${APP_NAME}. Use the verification code below to confirm your email address.</p>
      <div style="margin:16px 0;padding:16px;background:#eef2ff;border-radius:8px;text-align:center;">
        <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#6366f1;">${otp}</span>
      </div>
      <p style="margin:0 0 8px;color:#475569;"><strong>This code expires in 5 minutes.</strong></p>
      <p style="margin:0 0 8px;color:#475569;">For your security, never share this code with anyone. ${APP_NAME} staff will never ask you for it.</p>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">If you didn't create an account, you can safely ignore this email.</p>
    `),
    text: `Hi ${name ? name : ''},\n\nYour ${APP_NAME} verification code is: ${otp}\n\nThis code expires in 5 minutes.\nFor your security, never share this code with anyone. ${APP_NAME} staff will never ask for it.\n\nIf you didn't create an account, you can safely ignore this email.`,
  });

const sendRegistrationConfirmation = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration Received`,
    html: baseTemplate('Registration received', `<p style="margin:0 0 8px;color:#0f172a;">Hi ${name},</p><p style="margin:0 0 8px;color:#475569;">Your email has been verified. Your registration is now pending admin approval. You will be notified once approved.</p>`),
    text: `Hi ${name},\n\nYour email has been verified. Your registration is now pending admin approval. You will be notified once approved.`,
  });

const sendAdminNewRegistration = (to, name, email) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - New Registration Pending Approval`,
    html: baseTemplate('New registration', `<p style="margin:0 0 8px;color:#475569;">A new user has registered and is pending approval.</p><p style="margin:0 0 8px;color:#475569;"><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}</p><p style="margin:12px 0 0;"><a href="${APP_URL}/users" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Review in User Management</a></p>`),
    text: `A new user has registered and is pending approval.\nName: ${name}\nEmail: ${email}\nReview: ${APP_URL}/users`,
  });

const sendApproval = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration Approved`,
    html: baseTemplate('Registration approved', `<p style="margin:0 0 8px;color:#0f172a;">Hi ${name},</p><p style="margin:0 0 8px;color:#475569;">Your registration has been approved. You can now log in.</p><p style="margin:12px 0 0;"><a href="${APP_URL}/login" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Log In</a></p>`),
    text: `Hi ${name},\n\nYour registration has been approved. You can now log in: ${APP_URL}/login`,
  });

const sendRejection = (to, name, reason) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration Rejected`,
    html: baseTemplate('Registration rejected', `<p style="margin:0 0 8px;color:#0f172a;">Hi ${name},</p><p style="margin:0 0 8px;color:#475569;">Your registration has been rejected.</p>${reason ? `<p style="margin:0 0 8px;color:#475569;"><strong>Reason:</strong> ${reason}</p>` : ''}`),
    text: `Hi ${name},\n\nYour registration has been rejected.${reason ? '\nReason: ' + reason : ''}`,
  });

const sendAdminCreatedUser = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Account Created`,
    html: baseTemplate('Account created', `<p style="margin:0 0 8px;color:#0f172a;">Hi ${name},</p><p style="margin:0 0 8px;color:#475569;">An administrator has created an account for you. Please log in to get started.</p><p style="margin:12px 0 0;"><a href="${APP_URL}/login" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Log In</a></p>`),
    text: `Hi ${name},\n\nAn administrator has created an account for you. Please log in: ${APP_URL}/login`,
  });

const sendInvitationEmail = (to, inviterName, projectName, link) =>
  sendEmail({
    to,
    subject: `You're invited to join ${projectName} on ${APP_NAME}`,
    html: baseTemplate('Project invitation', `<p style="margin:0 0 8px;color:#475569;">Hi,</p><p style="margin:0 0 8px;color:#475569;"><strong>${inviterName}</strong> invited you to join project "<strong>${projectName}</strong>".</p><p style="margin:12px 0 0;"><a href="${link}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Accept Invitation</a></p><p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">This invitation may expire.</p>`),
    text: `Hi,\n\n${inviterName} invited you to join project "${projectName}".\nAccept: ${link}\nThis invitation may expire.`,
  });

const sendProjectActivity = (to, projectName, action, taskTitle, actorName, details, link) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - ${projectName}: ${action}`,
    html: baseTemplate(`${projectName} activity`, `<p style="margin:0 0 8px;color:#475569;"><strong>${actorName}</strong> ${action}${taskTitle ? ` on task "<strong>${taskTitle}</strong>"` : ''}.</p>${details ? `<p style="margin:0 0 8px;color:#475569;">${details}</p>` : ''}<p style="margin:12px 0 0;"><a href="${link || APP_URL}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Open Project</a></p>`),
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
    console.warn('[email] WARNING: SMTP_HOST is not set — OTP emails will FAIL. Set SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM in your environment (Vercel project settings for production).');
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
  verifyEmailConfig,
};
