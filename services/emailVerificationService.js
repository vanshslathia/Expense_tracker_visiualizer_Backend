const crypto = require("crypto");
const nodemailer = require("nodemailer");

/**
 * Create email transporter
 * Configured for Brevo (Sendinblue) SMTP and other providers
 */
const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ Email service not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env");
    return null;
  }

  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const isSecure = process.env.EMAIL_SECURE === "true" || port === 465;
  const isBrevo = process.env.EMAIL_HOST === "smtp-relay.brevo.com" || process.env.EMAIL_HOST?.includes("brevo.com");

  // Transporter configuration
  const transporterConfig = {
    host: process.env.EMAIL_HOST,
    port: port,
    secure: isSecure, // true for 465, false for other ports (like 587 for Brevo)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Brevo requires TLS for port 587
    ...(isBrevo && port === 587 && {
      requireTLS: true,
    }),
    // Connection pool settings
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
    // Timeout settings
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };

  return nodemailer.createTransport(transporterConfig);
};

/**
 * Generate a secure, random verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Send email verification email
 */
const sendVerificationEmail = async (userEmail, userName, verificationToken) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    
    console.log("📧 Preparing to send verification email:");
    console.log("   To:", userEmail);
    console.log("   Name:", userName);
    console.log("   Verification URL:", verificationUrl);

    const transporter = createTransporter();
    if (!transporter) {
      console.warn("⚠️ Email transporter not available. Skipping verification email send.");
      console.warn("   Check EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env file");
      return { sent: false, reason: "Email not configured. Please check server configuration." };
    }

    // Verify transporter connection before sending
    try {
      await transporter.verify();
      console.log("✅ SMTP server connection verified successfully");
    } catch (verifyError) {
      console.error("❌ SMTP connection verification failed:", verifyError.message);
      console.error("💡 Common issues:");
      console.error("   - For Gmail: Use App Password (not regular password)");
      console.error("   - Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS in .env");
      console.error("   - Ensure 2-Step Verification is enabled for Gmail");
      console.error("   - Check firewall/network settings");
      return { 
        sent: false, 
        reason: `SMTP connection failed: ${verifyError.message}. Please check your email configuration.` 
      };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Expensync</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Expensync</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #667eea; margin-top: 0;">Verify Your Email Address</h2>
            
            <p>Hello ${userName},</p>
            
            <p>Thank you for signing up for Expensync! To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="display: inline-block; background: #667eea; color: white; padding: 14px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #667eea; font-size: 12px; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ Important:</strong> This verification link will expire in 24 hours. If you didn't create an account with Expensync, please ignore this email.
              </p>
            </div>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
              If you're having trouble clicking the button, copy and paste the URL above into your web browser.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Verify Your Email Address - Expensync

Hello ${userName},

Thank you for signing up for Expensync! To complete your registration and activate your account, please verify your email address by clicking the link below:

${verificationUrl}

⚠️ Important: This verification link will expire in 24 hours. If you didn't create an account with Expensync, please ignore this email.

If you're having trouble clicking the link, copy and paste it into your web browser.
    `;

    // Use EMAIL_FROM if available, otherwise fall back to EMAIL_USER
    const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (!senderEmail) {
      const errorMsg = "EMAIL_FROM or EMAIL_USER not configured";
      console.error(`❌ ${errorMsg}`);
      return { sent: false, reason: errorMsg };
    }

    const mailOptions = {
      from: `"Expensync" <${senderEmail}>`,
      to: userEmail,
      subject: "Verify Your Email Address - Expensync",
      text: textContent,
      html: htmlContent,
    };

    console.log(`📧 Sending email from: ${senderEmail} to: ${userEmail}`);

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent successfully to ${userEmail}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}`);
    
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending verification email:", error.message);
    console.error("   Error code:", error.code || 'N/A');
    console.error("   SMTP command:", error.command || 'N/A');
    console.error("   SMTP response:", error.response || 'N/A');
    if (error.responseCode) {
      console.error("   Response code:", error.responseCode);
    }
    return { sent: false, reason: error.message || "Unknown error" };
  }
};

/**
 * Check if email domain is disposable/temporary
 * Optional: Block common disposable email domains
 */
const isDisposableEmail = (email) => {
  const disposableDomains = [
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "mailinator.com",
    "throwaway.email",
    "temp-mail.org",
    "getnada.com",
    "mohmal.com",
    "yopmail.com",
    "trashmail.com",
  ];

  const domain = email.split("@")[1]?.toLowerCase();
  return disposableDomains.includes(domain);
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  isDisposableEmail,
};
