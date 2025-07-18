import transporter from "../config/email";

export class EmailService {
  static async sendMagicLink(
    email: string,
    token: string,
    isNewUser: boolean = false
  ): Promise<void> {
    const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
    const action = isNewUser ? "Complete Your Registration" : "Sign In";

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: `Magic Link - ${action}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">${action}</h2>
          <p style="color: #666; line-height: 1.6;">
            ${
              isNewUser
                ? "Welcome! Click the button below to complete your registration and sign in to your account."
                : "Click the button below to sign in to your account."
            }
          </p>
          <p style="color: #666; line-height: 1.6;">
            This link will expire in ${
              process.env.MAGIC_LINK_EXPIRES_IN
            } minutes.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" 
               style="background-color: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;
                      font-weight: bold;">
              ${action}
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; color: #007bff; font-size: 12px; background-color: #f8f9fa; padding: 10px; border-radius: 5px;">
            ${magicLink}
          </p>
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you didn't request this, please ignore this email. This link will expire automatically.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  static async sendOnboardingNotification(
    email: string,
    name: string,
    action: string,
    subject: string,
    reason?: string,
    notes?: string
  ): Promise<void> {
    let content = "";
    let statusColor = "#007bff";

    switch (action) {
      case "approved":
        statusColor = "#28a745";
        content = `
        <h3 style="color: ${statusColor};">Congratulations! Your admin account has been approved.</h3>
        <p>You can now access all admin features and start managing your dashboard.</p>
        ${
          notes
            ? `<p><strong>Notes from Super Admin:</strong> ${notes}</p>`
            : ""
        }
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/dashboard" 
             style="background-color: ${statusColor}; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Access Admin Dashboard
          </a>
        </div>
      `;
        break;

      case "rejected":
        statusColor = "#dc3545";
        content = `
        <h3 style="color: ${statusColor};">Your admin account application has been rejected.</h3>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ""}
        <p>If you believe this is an error or would like to reapply, please contact our support team.</p>
      `;
        break;

      case "suspended":
        statusColor = "#ffc107";
        content = `
        <h3 style="color: ${statusColor};">Your admin account has been suspended.</h3>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ""}
        <p>Your account access has been temporarily disabled. Please contact the super admin for more information.</p>
      `;
        break;

      case "reactivated":
        statusColor = "#28a745";
        content = `
        <h3 style="color: ${statusColor};">Your admin account has been reactivated.</h3>
        <p>You can now access your admin dashboard again.</p>
        ${
          notes
            ? `<p><strong>Notes from Super Admin:</strong> ${notes}</p>`
            : ""
        }
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/dashboard" 
             style="background-color: ${statusColor}; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Access Admin Dashboard
          </a>
        </div>
      `;
        break;

      default:
        content = `<p>Your account status has been updated.</p>`;
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: subject,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Account Status Update</h2>
        <p style="color: #666;">Dear ${name},</p>
        ${content}
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from the admin panel.
          </p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
  }

  // src/services/emailService.ts - Add these methods to existing EmailService class

  // Security logout notification
  static async sendSecurityLogoutNotification(
    email: string,
    name: string,
    ipAddress?: string
  ): Promise<void> {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Security Alert - Account Logged Out",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc3545; text-align: center;">🔒 Security Alert</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Your account has been logged out for security reasons.
        </p>
        ${
          ipAddress
            ? `<p style="color: #666;"><strong>IP Address:</strong> ${ipAddress}</p>`
            : ""
        }
        <p style="color: #666; line-height: 1.6;">
          <strong>Time:</strong> ${new Date().toLocaleString()}
        </p>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>What to do next:</strong>
          </p>
          <ul style="color: #856404; margin: 10px 0;">
            <li>If this was you, no action is needed</li>
            <li>If this wasn't you, please log in and check your account security</li>
            <li>Consider changing your password if you suspect unauthorized access</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/auth/login" 
             style="background-color: #007bff; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Log In to Your Account
          </a>
        </div>
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated security notification. If you have concerns, please contact our support team.
          </p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
  }

  // Account deletion confirmation
  static async sendAccountDeletionConfirmation(
    email: string,
    name: string
  ): Promise<void> {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Account Deletion Confirmation",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Account Deletion Confirmation</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Your account has been successfully deleted from our system as requested.
        </p>
        <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
          <h3 style="color: #28a745; margin-top: 0;">What happens next:</h3>
          <ul style="color: #666; margin: 10px 0;">
            <li>Your personal data has been removed from our active systems</li>
            <li>You will no longer receive emails from us (except this confirmation)</li>
            <li>Your account cannot be used to access our services</li>
            <li>Some data may be retained for legal and audit purposes as per our privacy policy</li>
          </ul>
        </div>
        <p style="color: #666; line-height: 1.6;">
          <strong>Deletion completed on:</strong> ${new Date().toLocaleString()}
        </p>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Need to come back?</strong> If you change your mind, you can create a new account anytime using the same email address.
          </p>
        </div>
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Thank you for using our services. We're sorry to see you go!
          </p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
  }

  // Admin account deletion notification
  static async sendAdminAccountDeletionNotification(
    email: string,
    name: string,
    reason: string,
    notes?: string,
    adminName?: string
  ): Promise<void> {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Account Deleted by Administrator",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc3545; text-align: center;">Account Deletion Notice</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Your account has been deleted by an administrator.
        </p>
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #721c24;">
            <strong>Deletion Details:</strong>
          </p>
          <ul style="color: #721c24; margin: 10px 0;">
            <li><strong>Reason:</strong> ${reason
              .replace(/_/g, " ")
              .toUpperCase()}</li>
            ${
              adminName
                ? `<li><strong>Deleted by:</strong> ${adminName}</li>`
                : ""
            }
            <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          ${
            notes
              ? `<p style="color: #721c24;"><strong>Additional Notes:</strong> ${notes}</p>`
              : ""
          }
        </div>
        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0c5460;">
            <strong>What this means:</strong>
          </p>
          <ul style="color: #0c5460; margin: 10px 0;">
            <li>Your account access has been permanently removed</li>
            <li>You can no longer log in to our services</li>
            <li>Your personal data has been removed from active systems</li>
          </ul>
        </div>
        <p style="color: #666; line-height: 1.6;">
          If you believe this action was taken in error or if you have questions, please contact our support team immediately.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:support@yourcompany.com" 
             style="background-color: #007bff; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Contact Support
          </a>
        </div>
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated notification from the administrative system.
          </p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
  }

  // Forced logout notification
  static async sendForcedLogoutNotification(
    email: string,
    name: string,
    reason: string,
    adminName?: string
  ): Promise<void> {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Account Logged Out by Administrator",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ffc107; text-align: center;">⚠️ Forced Logout Notice</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          You have been logged out from all devices by an administrator.
        </p>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Logout Details:</strong>
          </p>
          <ul style="color: #856404; margin: 10px 0;">
            <li><strong>Reason:</strong> ${reason
              .replace(/_/g, " ")
              .toUpperCase()}</li>
            ${
              adminName
                ? `<li><strong>Performed by:</strong> ${adminName}</li>`
                : ""
            }
            <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
          </ul>
        </div>
        <p style="color: #666; line-height: 1.6;">
          You will need to log in again to access your account. If your account is still active, you can log in using your usual method.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/auth/login" 
             style="background-color: #007bff; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Log In Again
          </a>
        </div>
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            If you have questions about this action, please contact our support team.
          </p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
  }

  // Account restoration notification
  static async sendAccountRestorationNotification(
    email: string,
    name: string,
    adminName?: string
  ): Promise<void> {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Account Restored - Welcome Back!",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #28a745; text-align: center;">🎉 Account Restored!</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666; line-height: 1.6;">
          Great news! Your account has been restored and is now active again.
        </p>
        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #155724;">
            <strong>Restoration Details:</strong>
          </p>
          <ul style="color: #155724; margin: 10px 0;">
            ${
              adminName
                ? `<li><strong>Restored by:</strong> ${adminName}</li>`
                : ""
            }
            <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>Status:</strong> Your account is now fully active</li>
          </ul>
        </div>
        <p style="color: #666; line-height: 1.6;">
          You can now log in and access all your account features as before. Welcome back!
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/auth/login" 
             style="background-color: #28a745; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;
                    font-weight: bold;">
            Access Your Account
          </a>
        </div>
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated notification. We're happy to have you back!
          </p>
        </div>
      </div>
    `,
    };

    await transporter.sendMail(mailOptions);
  }
}
