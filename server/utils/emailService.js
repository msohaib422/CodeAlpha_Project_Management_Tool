const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const APP_NAME = 'CollabPM';
const APP_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const baseTemplate = (title, bodyHtml) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#6366f1;padding:20px 24px;color:#fff;font-size:20px;font-weight:700;">
          ${APP_NAME}
        </td></tr>
        <tr><td style="padding:24px;">
          <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${title}</h2>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">
          © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.SMTP_HOST) {
    console.log(`[email skipped - no SMTP] to=${to} subject=${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"${APP_NAME}" <no-reply@collabpm.com>`,
      to,
      subject,
      html,
      text: text || subject,
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

const sendOTP = (to, otp) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Email Verification Code`,
    html: baseTemplate('Verify your email', `<p>Your verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:12px 0;color:#6366f1;">${otp}</div><p>This code expires in 5 minutes.</p>`),
  });

const sendRegistrationConfirmation = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration Received`,
    html: baseTemplate('Registration received', `<p>Hi ${name},</p><p>Your email has been verified. Your registration is now pending admin approval. You will be notified once approved.</p>`),
  });

const sendAdminNewRegistration = (to, name, email) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - New Registration Pending Approval`,
    html: baseTemplate('New registration', `<p>A new user has registered and is pending approval.</p><p><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}</p><p><a href="${APP_URL}/users" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Review in User Management</a></p>`),
  });

const sendApproval = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration Approved`,
    html: baseTemplate('Registration approved', `<p>Hi ${name},</p><p>Your registration has been approved. You can now log in.</p><p><a href="${APP_URL}/login" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Log In</a></p>`),
  });

const sendRejection = (to, name, reason) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Registration Rejected`,
    html: baseTemplate('Registration rejected', `<p>Hi ${name},</p><p>Your registration has been rejected.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}`),
  });

const sendAdminCreatedUser = (to, name) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - Account Created`,
    html: baseTemplate('Account created', `<p>Hi ${name},</p><p>An administrator has created an account for you. Please log in to get started.</p><p><a href="${APP_URL}/login" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Log In</a></p>`),
  });

const sendInvitationEmail = (to, inviterName, projectName, link) =>
  sendEmail({
    to,
    subject: `You're invited to join ${projectName} on ${APP_NAME}`,
    html: baseTemplate('Project invitation', `<p>Hi,</p><p><strong>${inviterName}</strong> invited you to join project "<strong>${projectName}</strong>".</p><p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Accept Invitation</a></p><p>This invitation may expire.</p>`),
  });

const sendProjectActivity = (to, projectName, action, taskTitle, actorName, details, link) =>
  sendEmail({
    to,
    subject: `${APP_NAME} - ${projectName}: ${action}`,
    html: baseTemplate(`${projectName} activity`, `<p><strong>${actorName}</strong> ${action}${taskTitle ? ` on task "<strong>${taskTitle}</strong>"` : ''}.</p>${details ? `<p>${details}</p>` : ''}<p><a href="${link || APP_URL}" style="display:inline-block;padding:10px 18px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Open Project</a></p>`),
  });

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
};