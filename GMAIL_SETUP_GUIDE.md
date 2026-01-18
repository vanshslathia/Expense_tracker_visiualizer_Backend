# Gmail Email Verification Setup Guide

This guide will help you configure Gmail SMTP to send verification emails successfully.

## Quick Setup Steps

### Step 1: Enable 2-Step Verification
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on **"2-Step Verification"**
3. Follow the prompts to enable it (you'll need your phone)

### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
2. Select **"Mail"** as the app
3. Select **"Other (Custom name)"** as the device
4. Enter **"Expensync"** as the name
5. Click **"Generate"**
6. **Copy the 16-character password** (it will look like: `xxxx xxxx xxxx xxxx`)
   - ⚠️ **Important**: Copy it immediately - you won't be able to see it again!

### Step 3: Configure .env File
Create or edit `.env` file in the `server` directory with these settings:

```env
# Email Configuration (SMTP) - REQUIRED FOR EMAIL VERIFICATION
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # Use the App Password from Step 2 (remove spaces)

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

**Important Notes:**
- Replace `your-email@gmail.com` with your actual Gmail address
- Replace `xxxx xxxx xxxx xxxx` with the App Password from Step 2
- Remove spaces from the App Password when pasting it
- **DO NOT** use your regular Gmail password - it won't work!

### Step 4: Restart Your Server
1. Stop your server (press `Ctrl+C` in the terminal)
2. Start it again:
   ```bash
   cd server
   npm start
   ```

### Step 5: Test Email Sending
1. Try signing up with a new account
2. Check your server logs - you should see:
   - `✅ SMTP server connection verified successfully`
   - `✅ Verification email sent to [email]`
3. Check your Gmail inbox (and spam folder if needed)

## Troubleshooting

### ❌ "SMTP connection verification failed"
**Possible causes:**
- Wrong App Password (make sure you're using App Password, not regular password)
- 2-Step Verification not enabled
- Incorrect EMAIL_USER or EMAIL_PASS in .env
- Network/firewall blocking port 587

**Solutions:**
1. Double-check your .env file has correct values
2. Regenerate App Password and update EMAIL_PASS
3. Ensure 2-Step Verification is enabled
4. Check server logs for specific error messages

### ❌ "Email transporter not available"
**Cause:** Missing environment variables

**Solution:**
- Make sure `.env` file exists in the `server` directory
- Verify all EMAIL_* variables are set
- Restart server after changing .env

### ❌ Emails not received
**Possible causes:**
- Email went to spam folder
- Wrong email address used for signup
- Email sending failed silently

**Solutions:**
1. Check spam/junk folder in Gmail
2. Check server logs for error messages
3. Try resending verification email from the app
4. Verify the email address is correct

### ❌ "Invalid login" or "Authentication failed"
**Cause:** Wrong credentials

**Solutions:**
1. Make sure you're using **App Password**, not regular password
2. Regenerate App Password if needed
3. Remove any spaces from EMAIL_PASS
4. Verify EMAIL_USER is your full Gmail address

## Server Log Messages

### ✅ Success Messages:
```
✅ SMTP server connection verified successfully
✅ Verification email sent to user@example.com: <message-id>
```

### ⚠️ Warning Messages:
```
⚠️ Email service not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env
⚠️ Email transporter not available. Skipping verification email send.
```

### ❌ Error Messages:
```
❌ SMTP connection verification failed: [error message]
❌ Error sending verification email: [error details]
```

## Alternative Email Providers

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

## Security Best Practices

1. **Never commit .env file** - It contains sensitive credentials
2. **Use App Passwords** - More secure than regular passwords
3. **Rotate passwords regularly** - Regenerate App Passwords periodically
4. **Keep 2-Step Verification enabled** - Required for App Passwords

## Need Help?

If you're still having issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test SMTP connection using the verification step (already implemented)
4. Try regenerating App Password

The email service now includes automatic connection verification, so you'll see clear error messages if something is misconfigured.

