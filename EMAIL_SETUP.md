# Email Notification Setup Guide

This guide explains how to configure email notifications for budget alerts in the Expensync application.

## Overview

The email notification feature sends automated alerts to users when they exceed budget thresholds:
- **80% threshold**: Warning alert (high priority)
- **100% threshold**: Critical alert (critical priority)

Alerts are sent once per threshold per month to prevent spam.

## Environment Variables

Add the following variables to your `.env` file in the `server` directory:

```env
# Email Configuration (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

## Gmail Setup (Recommended)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification

### Step 2: Generate App Password
1. Go to Google Account → Security
2. Under "2-Step Verification", click "App passwords"
3. Select "Mail" and "Other (Custom name)"
4. Enter "Expensync" as the name
5. Copy the generated 16-character password
6. Use this password as `EMAIL_PASS` in your `.env`

### Step 3: Configure .env
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # App password from Step 2
```

## Other Email Providers

### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

### Yahoo Mail
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@yahoo.com
EMAIL_PASS=your-app-password
```

### Custom SMTP Server
```env
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587  # or 465 for SSL
EMAIL_SECURE=false  # true for port 465
EMAIL_USER=your-username
EMAIL_PASS=your-password
```

## Testing Email Configuration

1. Start your server:
   ```bash
   cd server
   npm start
   ```

2. Create a transaction that exceeds your budget threshold

3. Check your email inbox for the alert

4. Check server logs for email sending status:
   - `✅ Budget alert email sent` - Success
   - `⚠️ Email service not configured` - Missing env variables
   - `❌ Error sending budget alert email` - Configuration issue

## Troubleshooting

### Email Not Sending

1. **Check Environment Variables**
   - Ensure all EMAIL_* variables are set in `.env`
   - Restart server after changing `.env`

2. **Check SMTP Credentials**
   - Verify username and password are correct
   - For Gmail, use App Password (not regular password)

3. **Check Firewall/Network**
   - Ensure port 587 (or 465) is not blocked
   - Check if your hosting provider allows SMTP connections

4. **Check Server Logs**
   - Look for error messages in console
   - Common errors:
     - `Invalid login` - Wrong credentials
     - `Connection timeout` - Network/firewall issue
     - `Self-signed certificate` - Set `EMAIL_SECURE=false`

### Email Going to Spam

1. **Check SPF/DKIM Records** (for custom domains)
2. **Use a reputable email service** (Gmail, SendGrid, etc.)
3. **Include unsubscribe link** (future enhancement)

## Features

- ✅ Real-time budget threshold checking
- ✅ Email + in-app notifications
- ✅ Prevents duplicate alerts (once per threshold per month)
- ✅ Professional HTML email templates
- ✅ Non-blocking (doesn't slow down transaction creation)
- ✅ Graceful error handling (continues if email fails)

## Architecture

```
Transaction Created/Updated
    ↓
Transaction Controller
    ↓
Budget Alert Service (async, non-blocking)
    ↓
Check Budget Thresholds
    ↓
Has Alert Been Sent? (BudgetAlertStatus Model)
    ↓
No → Send Email + Create Notification
    ↓
Mark Alert as Sent
```

## Files Involved

- `server/services/emailService.js` - Email sending logic
- `server/services/budgetAlertService.js` - Budget checking & alert logic
- `server/models/BudgetAlertStatus.js` - Tracks sent alerts
- `server/controllers/transactionController.js` - Triggers alert check
- `client/src/components/notifications/NotificationBell.jsx` - Shows toast for critical alerts

## Future Enhancements

- Email preferences (user can disable email alerts)
- Weekly/monthly summary emails
- Customizable alert thresholds
- Email templates customization
- Unsubscribe functionality
