const nodemailer = require("nodemailer");

/**
 * Create email transporter
 * Uses environment variables for SMTP configuration
 * Configured for Brevo (Sendinblue) SMTP and other providers
 */
const createTransporter = () => {
  // Check if email is configured
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
 * Send budget alert email
 */
const sendBudgetAlertEmail = async (userEmail, userName, alertData) => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn("Email transporter not available. Skipping email send.");
      return { sent: false, reason: "Email not configured" };
    }

    const { currentSpending, budgetLimit, percentage, category, threshold, alertType } = alertData;

    // Determine subject and message based on threshold
    const isCritical = threshold === "100";
    const subject = isCritical
      ? `🚨 Budget Exceeded: ${category} - Expensync`
      : `⚠️ Budget Warning: ${category} - Expensync`;

    const thresholdMessage = isCritical
      ? "You have exceeded your monthly budget limit!"
      : "You are approaching your monthly budget limit.";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Budget Alert - Expensync</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Expensync</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: ${isCritical ? "#d32f2f" : "#f57c00"}; margin-top: 0;">
              ${isCritical ? "🚨 Budget Exceeded" : "⚠️ Budget Warning"}
            </h2>
            
            <p>Hello ${userName},</p>
            
            <p>${thresholdMessage}</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isCritical ? "#d32f2f" : "#f57c00"};">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Category:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${category}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Current Spending:</td>
                  <td style="padding: 8px 0; text-align: right; color: ${isCritical ? "#d32f2f" : "#f57c00"}; font-weight: bold;">
                    ₹${currentSpending.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #666;">Budget Limit:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">₹${budgetLimit.toLocaleString()}</td>
                </tr>
                <tr style="border-top: 2px solid #e0e0e0;">
                  <td style="padding: 12px 0; font-weight: bold; color: #666;">Usage:</td>
                  <td style="padding: 12px 0; text-align: right; font-size: 20px; color: ${isCritical ? "#d32f2f" : "#f57c00"}; font-weight: bold;">
                    ${percentage.toFixed(1)}%
                  </td>
                </tr>
              </table>
            </div>
            
            ${isCritical ? (
              `<div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
                <p style="margin: 0; color: #c62828; font-weight: bold;">
                  ⚠️ You have exceeded your budget by ₹${(currentSpending - budgetLimit).toLocaleString()}. 
                  Please review your spending and adjust your budget if needed.
                </p>
              </div>`
            ) : (
              `<div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f57c00;">
                <p style="margin: 0; color: #e65100;">
                  💡 You still have ₹${(budgetLimit - currentSpending).toLocaleString()} remaining in your budget. 
                  Consider reviewing your spending to stay within limits.
                </p>
              </div>`
            )}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/budget" 
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Budget Dashboard
              </a>
            </div>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
              This is an automated alert from Expensync. You're receiving this because you've set up budget tracking for your expenses.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Budget Alert - Expensync

Hello ${userName},

${thresholdMessage}

Category: ${category}
Current Spending: ₹${currentSpending.toLocaleString()}
Budget Limit: ₹${budgetLimit.toLocaleString()}
Usage: ${percentage.toFixed(1)}%

${isCritical 
  ? `⚠️ You have exceeded your budget by ₹${(currentSpending - budgetLimit).toLocaleString()}. Please review your spending.`
  : `💡 You still have ₹${(budgetLimit - currentSpending).toLocaleString()} remaining in your budget.`}

View your budget dashboard: ${process.env.FRONTEND_URL || "http://localhost:5173"}/budget

---
This is an automated alert from Expensync.
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
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    console.log(`📧 Sending email from: ${senderEmail} to: ${userEmail}`);

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Budget alert email sent successfully to ${userEmail}`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}`);
    
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending budget alert email:", error.message);
    console.error("   Error code:", error.code || 'N/A');
    console.error("   SMTP command:", error.command || 'N/A');
    console.error("   SMTP response:", error.response || 'N/A');
    if (error.responseCode) {
      console.error("   Response code:", error.responseCode);
    }
    return { sent: false, reason: error.message || "Unknown error" };
  }
};

module.exports = {
  sendBudgetAlertEmail,
};
