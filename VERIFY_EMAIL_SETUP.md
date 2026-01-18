# Quick Email Setup Verification Checklist

## ✅ Step-by-Step Verification

### 1. Check Your .env File Location
Make sure your `.env` file is in: `Expensync/server/.env`

### 2. Verify .env File Format
Your `.env` file should have these lines (with YOUR actual values):

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-actual-email@gmail.com
EMAIL_PASS=your-16-character-app-password
FRONTEND_URL=http://localhost:5173
```

**Important:**
- ✅ Remove spaces from App Password (if it was `xxxx xxxx xxxx xxxx`, use `xxxxxxxxxxxxxxxx`)
- ✅ Use your full Gmail address (e.g., `john.doe@gmail.com`)
- ✅ Use App Password, NOT your regular Gmail password

### 3. Restart Your Server
**This is CRITICAL!** Environment variables are only loaded when the server starts.

1. Stop your server: Press `Ctrl+C` in the terminal where server is running
2. Start it again:
   ```bash
   cd Expensync/server
   npm start
   ```

### 4. Check Server Logs
When the server starts, look for:
- ✅ `✅ Environment variables loaded successfully`
- ✅ No email-related warnings

### 5. Test Email Sending
1. Try signing up with a new account (or use the resend verification feature)
2. Watch your server logs - you should see:
   ```
   📧 Preparing to send verification email:
      To: [email]
      Name: [name]
      Verification URL: [url]
   ✅ SMTP server connection verified successfully
   ✅ Verification email sent to [email]: [message-id]
   ```

### 6. Check Your Email
- Check your Gmail inbox
- Check spam/junk folder (sometimes first emails go there)
- The email should arrive within a few seconds

## Common Issues & Quick Fixes

### ❌ "SMTP connection verification failed"
**Fix:** 
- Double-check EMAIL_USER and EMAIL_PASS in .env
- Make sure you're using App Password (not regular password)
- Remove any spaces from EMAIL_PASS
- Restart server after changing .env

### ❌ "Email transporter not available"
**Fix:**
- Check that .env file exists in `server` directory
- Verify all EMAIL_* variables are set
- Restart server

### ❌ No email received
**Fix:**
- Check spam folder
- Verify email address is correct
- Check server logs for error messages
- Try resending verification email

## Still Not Working?

1. Check server logs for specific error messages
2. Verify your App Password is correct (regenerate if needed)
3. Make sure 2-Step Verification is enabled on your Google Account
4. Try testing with a different email address

