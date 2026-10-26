/**
 * LifeLedger Transactional Email Templates
 * 
 * Provides clean, responsive, healthcare-grade transactional email templates
 * adhering to strict PHI security guidelines (no medical data in auth emails).
 */

export interface IEmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND_NAME = 'LifeLedger';
const BRAND_TAGLINE = 'Connecting You to Better Healthcare';
const BRAND_TEXT_COLOR = '#334155';

/**
 * Base email layout wrapper providing responsive inline styles and header/footer branding.
 */
const renderEmailLayout = (title: string, bodyContent: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: ${BRAND_TEXT_COLOR};
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      padding: 32px 28px;
      text-align: center;
      color: #ffffff;
    }
    .brand-logo {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
      color: #ffffff;
    }
    .brand-tagline {
      font-size: 13px;
      color: #e0f2fe;
      margin: 6px 0 0 0;
      font-weight: 400;
    }
    .content {
      padding: 36px 32px;
      line-height: 1.6;
      font-size: 15px;
    }
    .otp-container {
      background: #f8fafc;
      border: 2px dashed #0284c7;
      border-radius: 10px;
      text-align: center;
      padding: 22px;
      margin: 28px 0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0369a1;
      margin: 0;
      line-height: 1;
    }
    .otp-note {
      font-size: 13px;
      color: #64748b;
      margin-top: 10px;
      margin-bottom: 0;
    }
    .alert-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #92400e;
      margin: 24px 0;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer a {
      color: #0284c7;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .content { padding: 24px 20px; }
      .header { padding: 24px 20px; }
      .otp-code { font-size: 28px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center">
          <div class="container">
            <!-- Brand Header -->
            <div class="header">
              <h1 class="brand-logo">${BRAND_NAME}</h1>
              <p class="brand-tagline">${BRAND_TAGLINE}</p>
            </div>
            <!-- Email Body Content -->
            <div class="content">
              ${bodyContent}
            </div>
            <!-- Security Footer -->
            <div class="footer">
              <p style="margin: 0 0 6px 0;"><strong>${BRAND_NAME} Platform Security</strong></p>
              <p style="margin: 0 0 6px 0;">This is an automated transactional security message. Please do not reply directly to this email.</p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};

/**
 * Verification OTP Email Template (Account Signup & OTP Resend)
 */
export const renderVerificationEmail = (
  otp: string,
  expiryMinutes: number = 10,
  name?: string
): IEmailContent => {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const subject = 'Verify your LifeLedger account';

  const html = renderEmailLayout(
    subject,
    `
    <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Verify Your Email Address</h2>
    <p style="margin-top: 0;">${greeting}</p>
    <p>Thank you for joining <strong>LifeLedger</strong>. To complete your account verification and secure your health profile, please use the 6-digit verification code below:</p>
    
    <div class="otp-container">
      <p class="otp-code">${otp}</p>
      <p class="otp-note">Valid for <strong>${expiryMinutes} minutes</strong></p>
    </div>

    <div class="alert-box">
      <strong>Security Notice:</strong> LifeLedger staff will never ask for your verification code. If you did not create an account or request this code, you can safely ignore this email.
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      Connecting you to real-time health intelligence, secure health records, and trusted medical care.
    </p>
    `
  );

  const text = `${BRAND_NAME} - ${BRAND_TAGLINE}

${greeting}

Thank you for joining LifeLedger. To complete your account verification, please enter the following 6-digit code:

VERIFICATION CODE: ${otp}
(Valid for ${expiryMinutes} minutes)

SECURITY NOTICE:
LifeLedger staff will never ask for your verification code. If you did not create an account or request this code, please ignore this email.

© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`;

  return { subject, html, text };
};

/**
 * Password Reset OTP Email Template
 */
export const renderPasswordResetEmail = (
  otp: string,
  expiryMinutes: number = 10,
  name?: string
): IEmailContent => {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const subject = 'Reset your LifeLedger password';

  const html = renderEmailLayout(
    subject,
    `
    <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Password Reset Request</h2>
    <p style="margin-top: 0;">${greeting}</p>
    <p>We received a request to reset the password for your <strong>LifeLedger</strong> account. Enter the verification code below to proceed with resetting your password:</p>
    
    <div class="otp-container">
      <p class="otp-code">${otp}</p>
      <p class="otp-note">Valid for <strong>${expiryMinutes} minutes</strong></p>
    </div>

    <div class="alert-box">
      <strong>Security Warning:</strong> Never share this code with anyone. If you did not initiate this password reset, please review your account security immediately. Your current password remains unchanged until verified.
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      If you did not request this change, please ignore this email.
    </p>
    `
  );

  const text = `${BRAND_NAME} - ${BRAND_TAGLINE}

${greeting}

We received a request to reset the password for your LifeLedger account. Use the following code to continue:

PASSWORD RESET CODE: ${otp}
(Valid for ${expiryMinutes} minutes)

SECURITY WARNING:
Never share this code with anyone. If you did not initiate this password reset, please review your account security immediately. Your current password remains unchanged until verified.

© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`;

  return { subject, html, text };
};

/**
 * Password Reset Confirmation Email Template
 */
export const renderPasswordResetConfirmationEmail = (name?: string): IEmailContent => {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const subject = 'Your LifeLedger password has been updated';
  const timestamp = new Date().toUTCString();

  const html = renderEmailLayout(
    subject,
    `
    <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Password Changed Successfully</h2>
    <p style="margin-top: 0;">${greeting}</p>
    <p>The password for your <strong>LifeLedger</strong> account was successfully updated on <strong>${timestamp}</strong>.</p>
    
    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 6px; font-size: 13px; color: #065f46; margin: 24px 0;">
      <strong>Account Secured:</strong> All previous active sessions on other devices have been automatically logged out for your protection.
    </div>

    <div class="alert-box">
      <strong>Didn't make this change?</strong> If you did not reset your password, please contact our support team immediately to protect your medical vault and account.
    </div>
    `
  );

  const text = `${BRAND_NAME} - ${BRAND_TAGLINE}

${greeting}

The password for your LifeLedger account was successfully updated on ${timestamp}.

All previous active sessions on other devices have been automatically logged out for your security.

DIDN'T MAKE THIS CHANGE?
If you did not reset your password, please contact support immediately to secure your account.

© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`;

  return { subject, html, text };
};

/**
 * Email Change Verification OTP Email Template
 */
export const renderEmailChangeOtpEmail = (
  otp: string,
  expiryMinutes: number = 10,
  name?: string
): IEmailContent => {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const subject = 'Confirm your new email address for LifeLedger';

  const html = renderEmailLayout(
    subject,
    `
    <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Verify Your New Email Address</h2>
    <p style="margin-top: 0;">${greeting}</p>
    <p>You requested to update the email address associated with your <strong>LifeLedger</strong> account. Please use the 6-digit verification code below to confirm this change:</p>
    
    <div class="otp-container">
      <p class="otp-code">${otp}</p>
      <p class="otp-note">Valid for <strong>${expiryMinutes} minutes</strong></p>
    </div>

    <div class="alert-box">
      <strong>Security Notice:</strong> If you did not initiate this change in your LifeLedger account, please ignore this email and review your account security immediately.
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      Your email address will remain unchanged until this code is verified.
    </p>
    `
  );

  const text = `${BRAND_NAME} - ${BRAND_TAGLINE}

${greeting}

You requested to update your LifeLedger account email. Use the following code to confirm this change:

VERIFICATION CODE: ${otp}
(Valid for ${expiryMinutes} minutes)

SECURITY NOTICE:
If you did not initiate this change, please ignore this email. Your email address will remain unchanged until this code is verified.

© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.`;

  return { subject, html, text };
};

