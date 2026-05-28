const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (toEmail, userName, resetToken, resetUrl) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Reset Your Password</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#2563EB,#1d4ed8);padding:36px 40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🏥</div>
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Hospital Management</h1>
                <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">Password Reset Request</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <p style="color:#334155;font-size:16px;margin:0 0 8px;">Hi <strong>${userName}</strong>,</p>
                <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 28px;">
                  We received a request to reset your password. Click the button below to create a new password. 
                  This link is valid for <strong>15 minutes</strong>.
                </p>

                <!-- Button -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <a href="${resetUrl}" 
                         style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;
                                padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;
                                letter-spacing:0.2px;">
                        Reset My Password
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Token fallback -->
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:24px;">
                  <p style="color:#64748b;font-size:12px;margin:0 0 6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Or use this reset code</p>
                  <p style="color:#1e293b;font-size:22px;font-weight:800;margin:0;letter-spacing:4px;font-family:monospace;">${resetToken}</p>
                </div>

                <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;">
                  If you didn't request a password reset, you can safely ignore this email. 
                  Your password will remain unchanged.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
                <p style="color:#94a3b8;font-size:12px;margin:0;">
                  © ${new Date().getFullYear()} Hospital Management System. All rights reserved.
                </p>
                <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0;">
                  This is an automated email — please do not reply.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: '🔐 Reset Your Password — Hospital Management',
    html,
  });
};

module.exports = { sendPasswordResetEmail };
